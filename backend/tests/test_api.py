import asyncio
from tempfile import SpooledTemporaryFile

import httpx
import pytest
from fastapi.testclient import TestClient

from backend import main


def picture(**extra):
    return {'id': 'abc123', 'purity': 'sfw', 'path': 'https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg',
            'resolution': '1920x1080', 'url': 'https://wallhaven.cc/w/abc123',
            'dimension_x': 1920, 'dimension_y': 1080, 'colors': ['#000000'],
            'thumbs': {size: 'https://th.wallhaven.cc/small/ab/abc123.jpg' for size in ['small', 'large', 'original']}, **extra}


@pytest.fixture
def harness():
    calls = []
    state = {'handler': lambda request: httpx.Response(200, json={'data': [picture()], 'meta': {'current_page': 1, 'last_page': 2, 'per_page': 24, 'total': 30}})}
    def handler(request):
        calls.append(request)
        return state['handler'](request)
    with TestClient(main.app) as client:
        original = main.app.state.client
        main.app.state.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        yield client, state, calls
        client.portal.call(main.app.state.client.aclose)
        main.app.state.client = original


def test_filters_forwarded_sfw_seed_and_cached(harness, monkeypatch):
    client, _, calls = harness
    monkeypatch.setenv('WALLHAVEN_API_KEY', 'server-secret')
    url = '/api/wallpapers?q=forest&categories=100&sorting=random&seed=Abc123&atleast=1920x1080&ratios=16x9&colors=0066cc&page=2'
    response = client.get(url)
    assert response.status_code == 200
    assert response.json()['meta']['seed'] == 'Abc123'
    params = calls[0].url.params
    assert dict(params) == {'q': 'forest', 'categories': '100', 'sorting': 'random', 'seed': 'Abc123',
                            'atleast': '1920x1080', 'ratios': '16x9', 'colors': '0066cc', 'page': '2',
                            'purity': '100', 'apikey': 'server-secret'}
    assert 'server-secret' not in response.text
    assert client.get(url).status_code == 200
    assert len(calls) == 1


@pytest.mark.parametrize('query', ['categories=000', 'categories=abcd', 'page=0', 'page=1001',
                                 'sorting=malicious', 'colors=abcdef', 'seed=short',
                                 'ratios=0x9', 'atleast=10x0', 'purity=111', 'apikey=client-key'])
def test_reject_bad_filters(harness, query):
    client, _, calls = harness
    assert client.get('/api/wallpapers?' + query).status_code == 422
    assert not calls


def test_nonrandom_omits_seed_and_toprange_only_for_toplist(harness):
    client, _, calls = harness
    client.get('/api/wallpapers?sorting=toplist&topRange=1w&seed=Abc123')
    assert calls[0].url.params['topRange'] == '1w'
    assert 'seed' not in calls[0].url.params


def test_random_generates_fresh_seed(harness):
    client, _, _ = harness
    first = client.get('/api/wallpapers').json()['meta']['seed']
    second = client.get('/api/wallpapers').json()['meta']['seed']
    assert len(first) == 6
    assert first != second


@pytest.mark.parametrize('ratio', ['landscape', 'portrait', '16x9,21x9'])
def test_broad_and_multiple_ratios_forwarded(harness, ratio):
    client, _, calls = harness
    assert client.get('/api/wallpapers', params={'ratios': ratio}).status_code == 200
    assert calls[0].url.params['ratios'] == ratio


@pytest.mark.parametrize('data,meta', [([{'purity': 'sfw'}], {'current_page': 1}),
                                    ([picture()], {}), ([picture()], {'current_page': 'broken'}),
                                    ([picture(thumbs=None)], {'current_page': 1}),
                                    ([picture(dimension_x=-1)], {'current_page': 1})])
def test_invalid_upstream_shape_becomes_safe_gateway_error(harness, data, meta):
    client, state, _ = harness
    state['handler'] = lambda request: httpx.Response(200, json={'data': data, 'meta': meta})
    assert client.get('/api/wallpapers').status_code == 502


def test_no_unsafe_content_or_upstream_query_leak(harness):
    client, state, _ = harness
    state['handler'] = lambda request: httpx.Response(200, json={'data': [picture(), picture(purity='nsfw')],
        'meta': {'current_page': 1, 'last_page': 1, 'per_page': 24, 'total': 2, 'query': 'apikey=secret'}})
    response = client.get('/api/wallpapers')
    assert len(response.json()['data']) == 1
    assert 'secret' not in response.text


@pytest.mark.parametrize('code,expected', [(429, 429), (403, 502), (500, 502), (404, 404)])
def test_upstream_errors_are_sanitized(harness, code, expected):
    client, state, _ = harness
    state['handler'] = lambda request: httpx.Response(code, text='server-secret', headers={'retry-after': '30'})
    response = client.get('/api/wallpapers')
    assert response.status_code == expected
    assert 'server-secret' not in response.text
    if code == 429:
        assert response.headers['retry-after'] == '30'


def test_timeout_and_malformed_json(harness):
    client, state, _ = harness
    def timeout(request):
        raise httpx.ReadTimeout('sensitive request URL')
    state['handler'] = timeout
    assert client.get('/api/wallpapers').status_code == 504
    state['handler'] = lambda request: httpx.Response(200, text='not json')
    assert client.get('/api/wallpapers').status_code == 502


def test_detail_and_no_nsfw_access(harness):
    client, state, _ = harness
    state['handler'] = lambda request: httpx.Response(200, json={'data': picture(purity='nsfw')})
    assert client.get('/api/wallpapers/abc123').status_code == 404
    assert client.get('/api/wallpapers/not-valid').status_code == 422


@pytest.mark.parametrize('url', ['http://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg',
    'https://127.0.0.1/full/ab/wallhaven-abc123.jpg', 'https://w.wallhaven.cc.evil.test/full/ab/wallhaven-abc123.jpg',
    'https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg?redirect=localhost',
    'https://w.wallhaven.cc/full/ab/wallhaven-abcdef.jpg', 'https://w.wallhaven.cc@evil.test/full/ab/wallhaven-abc123.jpg'])
@pytest.mark.parametrize('route', ['download', 'image'])
def test_download_ssrf_rejected(harness, url, route):
    client, state, calls = harness
    state['handler'] = lambda request: httpx.Response(200, json={'data': picture(path=url)})
    assert client.get(f'/api/wallpapers/abc123/{route}').status_code == 502
    assert len(calls) == 1


def test_download_success_and_redirect_not_followed(harness):
    client, state, calls = harness
    def handler(request):
        if request.url.host == 'wallhaven.cc':
            return httpx.Response(200, json={'data': picture()})
        return httpx.Response(200, content=b'image bytes', headers={'content-type': 'image/jpeg'})
    state['handler'] = handler
    response = client.get('/api/wallpapers/abc123/download')
    assert response.content == b'image bytes'
    assert response.headers['content-disposition'] == 'attachment; filename="wallhaven-abc123.jpg"'
    assert calls[1].url.path == '/full/ab/wallhaven-abc123.jpg'
    assert main.app.state.download_slots._value == 4
    state['handler'] = lambda request: httpx.Response(302, headers={'location': 'http://127.0.0.1/secret'})
    assert client.get('/api/wallpapers/abc123/download').status_code == 502
    assert len(calls) == 3
    assert main.app.state.download_slots._value == 4


@pytest.mark.parametrize('route', ['download', 'image'])
@pytest.mark.parametrize('length', ['', '9'])
def test_download_cap_for_chunked_response(harness, monkeypatch, route, length):
    client, state, _ = harness
    monkeypatch.setattr(main, 'MAX_DOWNLOAD', 4)
    def handler(request):
        if request.url.host == 'wallhaven.cc':
            return httpx.Response(200, json={'data': picture()})
        return httpx.Response(200, content=b'too large', headers={'content-type': 'image/png', 'content-length': length})
    state['handler'] = handler
    assert client.get(f'/api/wallpapers/abc123/{route}').status_code == 413
    assert main.app.state.download_slots._value == 4


@pytest.mark.parametrize('content_type', ['image/jpeg', 'image/png', 'image/webp'])
def test_preview_image_is_inline_cacheable_and_releases_spool(harness, monkeypatch, content_type):
    client, state, calls = harness
    spools = []
    def create_spool(**kwargs):
        spool = SpooledTemporaryFile(**kwargs)
        spools.append(spool)
        return spool
    monkeypatch.setattr(main, 'SpooledTemporaryFile', create_spool)
    def handler(request):
        if request.url.host == 'wallhaven.cc':
            return httpx.Response(200, json={'data': picture()})
        assert request.headers['accept'] == 'image/jpeg,image/png,image/webp'
        return httpx.Response(200, content=b'image bytes', headers={'content-type': content_type})
    state['handler'] = handler
    response = client.get('/api/wallpapers/abc123/image')
    assert response.status_code == 200
    assert response.content == b'image bytes'
    assert response.headers['content-type'] == content_type
    assert response.headers['content-disposition'] == 'inline; filename="wallhaven-abc123.jpg"'
    assert response.headers['cache-control'] == 'public, max-age=3600'
    assert response.headers['x-content-type-options'] == 'nosniff'
    assert response.headers['content-length'] == str(len(response.content))
    assert len(calls) == 2
    assert len(spools) == 1 and spools[0].closed
    assert main.app.state.download_slots._value == 4


@pytest.mark.parametrize('code,expected', [(302, 502), (404, 404), (429, 429), (500, 502)])
def test_preview_upstream_failure_not_cached_and_releases_resources(harness, monkeypatch, code, expected):
    client, state, calls = harness
    spools = []
    def create_spool(**kwargs):
        spool = SpooledTemporaryFile(**kwargs)
        spools.append(spool)
        return spool
    monkeypatch.setattr(main, 'SpooledTemporaryFile', create_spool)
    def handler(request):
        if request.url.host == 'wallhaven.cc':
            return httpx.Response(200, json={'data': picture()})
        return httpx.Response(code, text='sensitive upstream body',
                              headers={'location': 'http://127.0.0.1/private', 'retry-after': '12'})
    state['handler'] = handler
    response = client.get('/api/wallpapers/abc123/image')
    assert response.status_code == expected
    assert 'sensitive' not in response.text
    assert 'cache-control' not in response.headers
    assert len(calls) == 2
    if code == 429:
        assert response.headers['retry-after'] == '12'
    assert spools[0].closed
    assert main.app.state.download_slots._value == 4
    assert main.app.state.request_slots._value == 8


@pytest.mark.parametrize('failure', ['timeout', 'network', 'html', 'svg'])
def test_preview_rejects_bad_images_and_sanitizes_network_errors(harness, failure):
    client, state, _ = harness
    def handler(request):
        if request.url.host == 'wallhaven.cc':
            return httpx.Response(200, json={'data': picture()})
        if failure == 'timeout':
            raise httpx.ReadTimeout('sensitive upstream URL')
        if failure == 'network':
            raise httpx.ConnectError('sensitive upstream URL')
        return httpx.Response(200, content=b'sensitive content',
                              headers={'content-type': 'text/html' if failure == 'html' else 'image/svg+xml'})
    state['handler'] = handler
    response = client.get('/api/wallpapers/abc123/image')
    assert response.status_code == (504 if failure == 'timeout' else 502)
    assert 'sensitive' not in response.text
    assert 'cache-control' not in response.headers
    assert main.app.state.download_slots._value == 4
    assert main.app.state.request_slots._value == 8


def test_download_slot_and_spool_closed_on_client_disconnect():
    async def scenario():
        slots = asyncio.Semaphore(1)
        await slots.acquire()
        spool = SpooledTemporaryFile()
        spool.write(b'image')
        spool.seek(0)
        response = main.SpoolDownloadResponse(spool, slots, media_type='image/jpeg')
        async def send(message):
            raise asyncio.CancelledError()
        async def receive():
            return {'type': 'http.disconnect'}
        with pytest.raises(asyncio.CancelledError):
            await response({'type': 'http', 'asgi': {'spec_version': '2.4'}}, receive, send)
        assert spool.closed
        assert slots._value == 1
    asyncio.run(scenario())


def test_spa_fallback_does_not_swallow_api_or_asset_404(harness, tmp_path, monkeypatch):
    client, _, _ = harness
    (tmp_path / 'index.html').write_text('<html>app</html>')
    monkeypatch.setattr(main, 'DIST', tmp_path)
    assert client.get('/gallery').text == '<html>app</html>'
    assert client.get('/api/missing').status_code == 404
    assert client.get('/assets/missing.js').status_code == 404
    assert client.get('/api/health').json() == {'status': 'ok'}


def test_cache_is_bounded_and_expires(monkeypatch):
    clock = [100]
    monkeypatch.setattr(main.time, 'monotonic', lambda: clock[0])
    cache = main.TTLCache(capacity=2, ttl=10)
    cache.put('a', 1)
    cache.put('b', 2)
    assert cache.get('a') == 1
    cache.put('c', 3)
    assert cache.get('b') is None
    clock[0] = 111
    assert cache.get('a') is None
