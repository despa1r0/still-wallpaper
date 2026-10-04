# Проверка контейнера

Дата: 2026-10-04. Цель: `Dockerfile` и `compose.yaml`.

Статус: **PASS для сборки, линтинга и runtime smoke checks; PARTIAL для security audit**. Контейнер имеет статус `healthy`; live-поиск Wallhaven, вертикальный фильтр и скачивание прошли. Checkov и сканирование уязвимостей образа не выполнялись.

## Применённые навыки

- `dockerfile-generator`: трёхэтапная сборка, отдельный слой зависимостей, Python venv, непривилегированный runtime, healthcheck и `.dockerignore`.
- `dockerfile-validator`: первичный скрипт и документированный fallback.

Прочитаны `dockerfile-generator/references/security_best_practices.md`, `optimization_patterns.md`, `language_specific_guides.md`. Референсы валидатора не понадобились: actionable findings не обнаружены.

## Результаты

| Итерация | Проверка | Ошибки | Предупреждения | Изменения | Результат |
|---|---|---:|---:|---|---|
| 1 | `PIP_RETRIES=0 PIP_TIMEOUT=5 bash /home/cqa/.codex/skills/dockerfile-validator/scripts/dockerfile-validate.sh Dockerfile` | Не оценивались | Не оценивались | Не требовались | Установка `hadolint-bin` недоступна в текущем package index; скрипт завершился до анализа |
| 1, fallback | `docker run --rm -i hadolint/hadolint:v2.12.0 < Dockerfile` | 0 | 0 | Не требовались | PASS, exit 0 |
| 1, fallback | `docker compose config --quiet` | 0 | 0 | Не требовались | PASS, exit 0 |
| 1, fallback | Статическая проверка Dockerfile и `.dockerignore` через Python standard library | 0 | 0 | Не требовались | 11 проверок PASS |
| 2 | `docker compose build` | 0 | 0 lint-находок | `/tmp` увеличен до 384 MiB для временных файлов | PASS |
| 2 | `docker compose up -d --wait --wait-timeout 45` | 0 | 0 | Не требовались | PASS, `healthy` |
| 2 | HTTP smoke checks внутри контейнера | 1 | 0 | Исправление маршрута скачивания передано владельцу бэкенда | Страницы/API PASS; download требует повторной проверки |
| 3 | `docker compose up -d --build --wait --wait-timeout 45` и HTTP smoke checks | 0 | 0 | Исправлен URL `/full/`; ограничена параллельность скачивания до полного закрытия файла | PASS: healthy, live-фильтры, детали и скачивание |

Первичный скрипт устанавливал Python-инструменты только во временные venv в `/tmp` и удалил их при завершении. Системные Python-пакеты не изменялись. Доступ к Docker Engine 29.8.2 проверен через `docker info`; для Docker в этой среде требовался запуск вне файловой песочницы.

Проверены: три этапа сборки; отсутствие `latest` в базовых образах; отсутствие литеральных секретов в `ARG`/`ENV`; пользователь `app`; единственный порт 8000; `/api/health`; JSON-форма `CMD`; установка Python только в `/opt/venv`; использование lockfile и `npm ci`; отсутствие `ADD`; исключение секретов и локальных зависимостей из контекста.

Runtime: `os.getuid()` вернул `10001`, `sys.prefix` — `/opt/venv`. Маршруты `/`, `/gallery`, `/api/health`, `/api/filter-options` вернули HTTP 200. Live-запрос `/api/wallpapers?sorting=date_added&categories=100&page=1` вернул HTTP 200 и 24 изображения. Запрос с `ratios=portrait` вернул 24 изображения; у всех высота больше ширины. После исправления проверки URL детали и скачивание SFW-изображения `7jxm19` вернули HTTP 200: `image/jpeg`, `attachment; filename="wallhaven-7jxm19.jpg"`, 120725 байт.

## Классификация

- Critical: обнаруженных нет.
- High: обнаруженных нет.
- Medium: обнаруженных нет.
- Low: обнаруженных нет.

Это результаты выполненных проверок, а не заключение об отсутствии всех уязвимостей. Checkov не запускался: первичный установщик завершился на предыдущем шаге. Сканирование CVE базовых и финального образов не выполнялось.

## Решения по сборке

| Решение | Причина | Ограничение | Когда пересмотреть |
|---|---|---|---|
| `node:22-alpine`, `python:3.12-slim` без digest | Получение исправлений в выбранной версии при пересборке | Базовый образ может измениться | Перед production-релизом, если нужна точная воспроизводимость |
| Один процесс uvicorn | Кэш API находится в памяти процесса | Нет общего кэша между репликами | При горизонтальном масштабировании |

Отклонений от обнаруженных lint-правил нет; suppressions не добавлялись.

## Оптимизация

| Метрика | Подтверждённое свойство / статус |
|---|---|
| Runtime | Python slim + runtime venv + backend + собранные статические файлы |
| Node.js / npm в runtime | Не копируются из этапа сборки |
| Кэш зависимостей | `package*.json` и `requirements.txt` копируются до исходников |
| Файлы разработки и секреты | Исключаются `.dockerignore` |
| Размер образа | 265125924 байт по `docker image inspect weather-app` (около 253 MiB) |
| Время сборки | Не измерено |

## Воспроизведение и оставшиеся проверки

```bash
docker compose config --quiet
docker run --rm -i hadolint/hadolint:v2.12.0 < Dockerfile
docker compose up -d --build
docker compose ps
curl --fail http://localhost:8000/api/health
curl --fail http://localhost:8000/
docker compose images
docker compose down
```

Сканирование итогового образа доступным CVE-сканером остаётся отдельной непроведённой проверкой. Пользовательский ключ для проверки публичного SFW-поиска не требуется.
