"""Same-origin app server and bounded, SFW-only Wallhaven API adapter."""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from contextlib import asynccontextmanager
import os
from pathlib import Path
import re
import secrets
import string
from tempfile import SpooledTemporaryFile
import time
from typing import Annotated, Literal
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, ValidationError, field_validator

COLORS = '660000 990000 cc0000 cc3333 ea4c88 993399 663399 333399 0066cc 0099cc 66cccc 77cc33 669900 336600 666600 999900 cccc33 ffff00 ffcc33 ff9900 ff6600 cc6633 996633 663300 000000 999999 cccccc ffffff 424153'.split()
MAX_DOWNLOAD = 40 * 1024 * 1024
API_BASE = 'https://wallhaven.cc/api/v1'
DIST = Path(__file__).resolve().parent.parent / 'frontend' / 'dist'


class SearchParams(BaseModel):
    model_config = ConfigDict(extra='forbid')
    q: str = Field(default='', max_length=200)
    categories: str = Field(default='111', pattern=r'^[01]{3}$')
    sorting: Literal['random', 'date_added', 'views', 'favorites', 'toplist', 'relevance'] = 'random'
    topRange: Literal['1d', '3d', '1w', '1M', '3M', '6M', '1y'] = '1M'
    atleast: str = Field(default='', pattern=r'^(?:[1-9][0-9]{1,4}x[1-9][0-9]{1,4})?$')
    ratios: str = Field(default='', max_length=80, pattern=r'^(?:landscape|portrait|(?:[1-9][0-9]?x[1-9][0-9]?)(?:,[1-9][0-9]?x[1-9][0-9]?)*)?$')
    colors: str = ''
    page: int = Field(default=1, ge=1, le=1000)
    seed: str = Field(default='', pattern=r'^(?:[a-zA-Z0-9]{6})?$')

    @field_validator('categories')
    @classmethod
    def selected_category(cls, value):
        if value == '000':
            raise ValueError('Select at least one category')
        return value

    @field_validator('colors')
    @classmethod
    def supported_color(cls, value):
        value = value.lower().removeprefix('#')
        if value and value not in COLORS:
            raise ValueError('Unsupported Wallhaven color')
        return value


class ThumbnailShape(BaseModel):
    small: AnyHttpUrl
    large: AnyHttpUrl
    original: AnyHttpUrl


class WallpaperShape(BaseModel):
    id: str = Field(pattern=r'^[a-z0-9]{6}$')
    url: AnyHttpUrl
    path: AnyHttpUrl
    thumbs: ThumbnailShape
    dimension_x: int = Field(gt=0, strict=True)
    dimension_y: int = Field(gt=0, strict=True)
    resolution: str = Field(pattern=r'^[1-9][0-9]*x[1-9][0-9]*$')
    colors: list[str]


class PaginationShape(BaseModel):
    current_page: int = Field(ge=1, strict=True)
    last_page: int = Field(ge=1, strict=True)
    per_page: int = Field(ge=1, strict=True)
    total: int = Field(ge=0, strict=True)


class TTLCache:
    def __init__(self, capacity=128, ttl=180):
        self.capacity, self.ttl = capacity, ttl
        self.items = OrderedDict()

    def get(self, key):
        entry = self.items.get(key)
        if entry is None:
            return None
        expires, value = entry
        if expires <= time.monotonic():
            del self.items[key]
            return None
        self.items.move_to_end(key)
        return value

    def put(self, key, value):
        self.items[key] = (time.monotonic() + self.ttl, value)
        self.items.move_to_end(key)
        while len(self.items) > self.capacity:
            self.items.popitem(last=False)


@asynccontextmanager
async def lifespan(app):
    app.state.cache = TTLCache()
    app.state.request_slots = asyncio.Semaphore(8)
    app.state.download_slots = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=8), follow_redirects=False,
                                 limits=httpx.Limits(max_connections=12),
                                 headers={'User-Agent': 'still/1.0', 'Accept': 'application/json'}) as client:
        app.state.client = client
        yield


app = FastAPI(title='still', lifespan=lifespan)


def upstream_error(response):
    if response.status_code == 429:
        retry = response.headers.get('retry-after', '60')
        raise HTTPException(429, 'Wallhaven rate limit reached. Please try again shortly.',
                            headers={'Retry-After': retry if retry.isdigit() else '60'})
    if response.status_code == 404:
        raise HTTPException(404, 'Wallpaper not found')
    if response.status_code >= 300:
        raise HTTPException(502, 'Wallhaven is temporarily unavailable')


async def upstream(endpoint, params=None):
    params = dict(params or {})
    key = (endpoint, tuple(sorted(params.items())))
    cached = app.state.cache.get(key)
    if cached is not None:
        return cached
    api_key = os.getenv('WALLHAVEN_API_KEY')
    if api_key:
        params['apikey'] = api_key
    try:
        async with app.state.request_slots:
            response = await app.state.client.get(f'{API_BASE}/{endpoint}', params=params)
        upstream_error(response)
        data = response.json()
        if not isinstance(data, dict) or 'data' not in data:
            raise ValueError('Invalid shape')
    except httpx.TimeoutException:
        raise HTTPException(504, 'Wallhaven took too long to respond') from None
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, 'Could not read the Wallhaven response') from None
    app.state.cache.put(key, data)
    return data


def clean_wallpaper(item):
    if not isinstance(item, dict) or item.get('purity') not in ('sfw', 'sketchy', 'nsfw'):
        raise HTTPException(502, 'Invalid Wallhaven wallpaper')
    if item['purity'] != 'sfw':
        return None
    try:
        WallpaperShape.model_validate(item)
    except ValidationError:
        raise HTTPException(502, 'Invalid Wallhaven wallpaper') from None
    keys = ['id', 'url', 'short_url', 'views', 'favorites', 'source', 'purity', 'category',
            'dimension_x', 'dimension_y', 'resolution', 'ratio', 'file_size', 'file_type',
            'created_at', 'colors', 'path', 'thumbs', 'tags', 'uploader']
    return {key: item[key] for key in keys if key in item}


def validate_id(wallpaper_id):
    if not re.fullmatch(r'[a-z0-9]{6}', wallpaper_id):
        raise HTTPException(422, 'Invalid wallpaper ID')


async def detail(wallpaper_id):
    validate_id(wallpaper_id)
    data = await upstream(f'w/{wallpaper_id}')
    item = clean_wallpaper(data['data'])
    if item is None:
        raise HTTPException(404, 'SFW wallpaper not found')
    if item['id'] != wallpaper_id:
        raise HTTPException(502, 'Wallhaven returned the wrong wallpaper')
    return item


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.get('/api/filter-options')
def filter_options():
    return {'colors': COLORS, 'categories': ['general', 'anime', 'people'],
            'sorting': ['random', 'date_added', 'views', 'favorites', 'toplist', 'relevance'],
            'topRange': ['1d', '3d', '1w', '1M', '3M', '6M', '1y'],
            'ratios': ['landscape', 'portrait', '16x9', '16x10', '21x9', '4x3', '1x1', '9x16', '9x19', '9x20'],
            'atleast': ['1920x1080', '2560x1440', '3840x2160', '1080x1920'], 'purity': '100'}


@app.get('/api/wallpapers')
async def wallpapers(filters: Annotated[SearchParams, Query()]):
    params = {key: str(value) for key, value in filters.model_dump().items() if value != ''}
    params['purity'] = '100'
    if filters.sorting != 'toplist':
        params.pop('topRange', None)
    if filters.sorting == 'random':
        params.setdefault('seed', ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(6)))
    else:
        params.pop('seed', None)
    result = await upstream('search', params)
    if not isinstance(result['data'], list) or not isinstance(result.get('meta'), dict):
        raise HTTPException(502, 'Invalid Wallhaven listing')
    items = [clean_wallpaper(item) for item in result['data']]
    try:
        meta = PaginationShape.model_validate(result['meta']).model_dump()
    except ValidationError:
        raise HTTPException(502, 'Invalid Wallhaven pagination') from None
    if filters.sorting == 'random':
        meta['seed'] = params['seed']
    return {'data': [item for item in items if item is not None], 'meta': meta}


@app.get('/api/wallpapers/{wallpaper_id}')
async def wallpaper(wallpaper_id: str):
    return {'data': await detail(wallpaper_id)}


class SpoolDownloadResponse(StreamingResponse):
    """Keep a download permit until its temporary file is closed, even on disconnect."""
    def __init__(self, spool, slots, **kwargs):
        self.spool, self.slots = spool, slots
        def chunks():
            while chunk := spool.read(65536):
                yield chunk
        super().__init__(chunks(), **kwargs)

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            self.spool.close()
            self.slots.release()


@app.get('/api/wallpapers/{wallpaper_id}/download')
async def download(wallpaper_id: str):
    item = await detail(wallpaper_id)
    image_url = item.get('path', '')
    parsed = urlsplit(image_url)
    pattern = rf'/full/{wallpaper_id[:2]}/wallhaven-{wallpaper_id}\.(jpg|png|webp)'
    if (parsed.scheme != 'https' or parsed.netloc != 'w.wallhaven.cc' or parsed.query or parsed.fragment
            or not re.fullmatch(pattern, parsed.path)):
        raise HTTPException(502, 'Wallhaven returned an unsupported image URL')
    slots = app.state.download_slots
    await slots.acquire()
    spool = None
    try:
        spool = SpooledTemporaryFile(max_size=1024 * 1024)
        async with app.state.request_slots:
            async with app.state.client.stream('GET', image_url) as response:
                upstream_error(response)
                content_type = response.headers.get('content-type', '').split(';')[0]
                if content_type not in ('image/jpeg', 'image/png', 'image/webp'):
                    raise HTTPException(502, 'Wallhaven returned an invalid image')
                length = response.headers.get('content-length', '')
                if length.isdigit() and int(length) > MAX_DOWNLOAD:
                    raise HTTPException(413, 'Image exceeds the 40 MB download limit')
                size = 0
                async for chunk in response.aiter_bytes(65536):
                    size += len(chunk)
                    if size > MAX_DOWNLOAD:
                        raise HTTPException(413, 'Image exceeds the 40 MB download limit')
                    spool.write(chunk)
        spool.seek(0)
    except BaseException as exc:
        if spool is not None:
            spool.close()
        slots.release()
        if isinstance(exc, httpx.HTTPError):
            raise HTTPException(502, 'Image download failed. Please try again.') from None
        raise
    return SpoolDownloadResponse(spool, slots, media_type=content_type,
                             headers={'Content-Disposition': f'attachment; filename="{Path(parsed.path).name}"',
                                      'Content-Length': str(size)})


@app.get('/{file_path:path}', include_in_schema=False)
def frontend(file_path: str):
    if file_path == 'api' or file_path.startswith('api/'):
        raise HTTPException(404, 'API route not found')
    root = DIST.resolve()
    requested = (root / file_path).resolve()
    if requested.is_relative_to(root) and requested.is_file():
        return FileResponse(requested)
    if file_path.startswith('assets/') or Path(file_path).suffix:
        raise HTTPException(404, 'File not found')
    if (root / 'index.html').is_file():
        return FileResponse(root / 'index.html')
    raise HTTPException(404, 'Frontend is not built. Run the frontend build or Vite development server.')
