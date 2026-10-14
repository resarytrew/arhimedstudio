# ArhimedStudio — основная архитектурная спецификация

Статус: утверждена пользователем. Реализация последовательная, с обязательной приёмкой этапов. Этот документ задаёт требования, а не заявляет их выполнение. Фактический статус: [stages.md](stages.md).

## 1. Неизменяемые принципы

- Studio и опубликованные лекции работают на статическом хостинге/GitHub Pages без обязательного backend или локального Python.
- Arhimed Canvas остаётся самостоятельным поддерживаемым движком. Сохраняются проекты, предпросмотр, таймлайн, перемотка, PNG/WebM и демонстрация главной страницы.
- Движки независимы: Canvas (TypeScript-интерпретатор), ManimGX (Python/Pyodide/WASM/WebGPU), Manim Community и ManimGL (дополнительные локальные Python-runtime), JS/TS-модели Canvas/WebGL, декларативные JSON-модели.
- Исходники сохраняются. Автоконвертация между движками запрещена. Отдельная конвертация требует diff, согласия автора и новой сцены.
- Анимация, интерактивная модель и исследовательский урок имеют отдельные контракты; таймлайн не обязателен для каждого модуля.
- Новые адаптеры не меняют существующий Canvas-таймлайн в универсальный графический формат.

## 2. Контракты

### EngineAdapterV1 и проекты

Метаданные: engineId, adapterVersion, runtimeVersion, языки и диалекты. Жизненный цикл: probe, createSession, load/update, stop, dispose. Capabilities: playback, seek, timeline, block execution, model parameters, snapshot, export, publication modes. Неподдерживаемые операции возвращают unsupported.

События состояния/диагностики/прогресса/результатов несут projectId, sceneId, revision, requestId. Устаревшие ответы не меняют актуальную сцену. Реестр адаптеров контролирует Studio; пакет не может установить исполняемый адаптер по произвольному URL.

Проект хранит оригинальные файлы, язык/диалект, engineId/version, entrypoint, ресурсы/хеши, настройки и неизменяемые ревизии. Старые проекты открываются как Canvas/arhimed-manimx-v1 без переписывания кода. Хранилище arhimed.projects.v1 сохраняется для восстановления. Компиляция TS создаёт производный JS, сохраняя TS.

### AIOrchestratorV1 / LLMProviderV1

Независимая оркестрация: OpenRouter, OpenAI-compatible, существующий офлайн-ассистент. Провайдеры: listModels, availability/checkConnection, generate с AbortSignal, нормализованные ошибки. Каталог кешируется; наличие модели не гарантирует доступность запроса.

BYOK без backend. Ключ по умолчанию в памяти, сохранение явно разрешается автором с объяснением ограничений. Ключ доступен только клиенту провайдера Studio, никогда не передаётся в prompts, runtime, sandbox messages, логи, проекты или публикации.

Для каждого движка версионированные инструкции, примеры API, ограничения, диагностика и правила исправления. Генерация/редактирование/исправление создают кандидатную ревизию с baseRevision. Применение — после diff и решения автора; изменившаяся база запрещает автоматическую перезапись. Проверка кандидата только в недоверенном runtime. Принятие кода не даёт локального доверия.

Один активный запрос на проект, ограничения контекста, выходных токенов и времени. Отмена AbortController; обработка авторизации, сети, баланса, rate limits, повреждённого ответа. Нет автоматического повтора неоднозначно завершившихся платных запросов/смены модели. Локальная оценка стоимости не гарантирует финансовый лимит. Лимиты OpenRouter читаются через API.

### PublicationManagerV1 / PublicationTargetV1

Контент не зависит от доставки (ZIP, GitHub Pages, будущий API). Статусы относятся к ревизии:
- draft → validating → ready;
- ошибка проверки → draft + отчёт;
- ready → published только после подтверждённого deployment;
- published → archived после применения архивирования;
- изменение создаёт новый draft, опубликованная версия неизменна.

ZIP не равен публикации. Ошибка deployment сохраняет прежнюю рабочую публикацию. Пакет: viewer, manifest, исходники, обложка, публичные метаданные, ресурсы, runtime, лицензии и fallback. Приватные диалоги, настройки, ключи и доверие исключаются allowlist полей.

Ссылки: /lectures/{id}/ — выбранная версия; /lectures/{id}/versions/{version}/ — неизменяемая. Откат повторно развёртывает выбранную версию. Архивирование скрывает из галереи без уничтожения истории.

### EducationalValidatorV1

Вход: ревизия и артефакты. Выход: категория, severity, расположение, доказательство, ограничения, версия валидатора. Категории: вычисления; единицы/размерности; допущения; читаемость; педагогический сценарий; источники/факты.

V1: интерфейс, авторский checklist, доступные детерминированные проверки. Непроверенное — not_checked. Научная проверка не блокирует разработку V1; технические нарушения безопасности блокируют публикацию. Автор утверждает содержание конкретной ревизии.

## 3. Gate: эксперимент ManimGX

Репозиторий resarytrew/arhimed-runtime-lab, публичный GitHub Pages через Actions. Настоящий ManimGX v0.1.1, фиксированные зависимости. Без рефакторинга Studio и без реальных ключей/проектов.

Порядок конфигураций:
1. sandboxed iframe opaque origin без allow-same-origin, Worker внутри.
2. При несовместимости — отдельный непривилегированный HTTPS-origin, sandbox и строгая CSP. Другой путь того же origin не считается изоляцией.
3. Если безопасного рабочего варианта нет — отрицательный отчёт и остановка масштабной интеграции. Изоляцию не ослаблять.

Проверить WebGPU/features, Pyodide, WASM, Worker, ресурсы/шрифты/CSP совместно, не только navigator.gpu. Отключить auto-install Python-зависимостей; изменения загрузчика описать отдельно от настоящего GX.

Негативные тесты: искусственные canary в DOM/settings/localStorage/IndexedDB родителя; доступ через Python/JS bridge/Worker/iframe; HTTP/WebSocket/scripts/navigation/forms/localhost; подделка сообщений, ревизий и ресурсов, oversized messages; бесконечный цикл, исключение, controlled memory pressure, GPU loss, forced stop. Не считать fetch monkeypatch защитой. Проверить CSP Worker. Отмена не требует SharedArrayBuffer: terminate Worker/iframe.

Браузер не гарантирует hard limits общей RAM/GPU. Не обещать абсолютную безопасность. В отчёте: URL, commit/hashes, версии ОС/браузеров/GPU, тесты, CSP logs, cold/warm timings и инструкции. Реальные Chrome/Edge на Windows, отсутствие WebGPU, missing features; непроверенные браузеры не certified. Целевой warm p95 first-current-frame ≤1 s для простого фрагмента; cold boot/new formula отдельно. Невыполненная цель/изоляция требует решения до этапа 2.

## 4. Публикация и безопасность

### Manifest

schemaVersion, id/version, типы модулей/связи, engines/runtime versions, language/source files, resource hashes, requirements, playback modes, fallbacks, metadata/cover, sections/captions, model parameters, integration extensions. Относительные пути и подпапка GitHub Pages, без localhost/backend.

Canvas — браузер; GX — только проверенная конфигурация, иначе подготовленное видео; CE/GL — MP4/WebM + исходники. Лаборатории браузерные. Видео не считается выполненным интерактивным экспериментом. GX fallback обязателен: подтверждённый экспорт, дополнительный локальный рендер или загрузка автором; связать с revision. Устаревший fallback не ready. Непроверенный браузерный экспорт GX не объявлять реализованным.

Пакет включает нужные runtime assets без обязательного CDN и нестандартных заголовков. Путь V1: validate → export → commit/PR автора → Actions → deploy → verify manifest. GitHub token в Studio не требуется. Actions не исполняет пользовательские сцены в privileged deploy job. Проверка и публикация имеют раздельные минимальные permissions. Будущий remote runtime через capabilities, без реализации в V1.

### Browser isolation

Непривилегированный iframe-origin + Worker, строгая CSP, запрещённая произвольная сеть/navigation/forms, никаких ключей или хранилищ Studio. Typed MessageChannel с валидацией источника, session/revision, типов и размеров. Ресурсы только по разрешённым id; никаких произвольных URL/путей. Окружения проектов не разделяют исполняемое состояние. Watchdog, terminate, context disposal и fallback. Runtime packages закреплены; произвольный код не устанавливает пакеты или адаптеры.

### Native Python

CE/GL независимы. Default — VM isolation, непривилегированное окружение, CPU/RAM/time/process/output limits, no network/secrets/host directories. GPU только после проверки. Отсутствие sandbox не включает прямой запуск.

Trusted — предупреждение + согласие для хеша project/source/resources/dependencies; off by default. Любое изменение исполняемых входов отзывает доверие; немедленный revoke останавливает job. Доверие не экспортируется и не применяется к серверным опубликованным сценам. Один job contract для обоих режимов.

Warm processes/caches/block execution внутри границы безопасности. Графический checkpoint не полный Python snapshot; при невозможности восстановления последовательный replay. Полный экспорт из чистого исходника. Измерять оба режима, не предполагать ускорение direct execution.

### Reproducibility and licensing

Lock engine/runtime/dependency/build versions и hashes. SBOM/лицензии шрифтов, аудио, изображений, WASM и транзитивных компонентов. Учитывать лицензию конкретного distributable, не только основного проекта.

Проверять hashes, packed/unpacked sizes, file count, paths/traversal, duplicates, symlinks. Исполняемый код только в зарегистрированных viewer/runtime и sandbox-модулях: проверять содержимое/ссылки, не только расширения. Export allowlist + secret scan, включая секреты в исходнике автора. Нет приватных диалогов и внутренних настроек.

## 5. Шаблоны и этапы

50 полноценных материалов: 20 математика, 15 физика, 10 история, 5 междисциплинарных исследовательских уроков. Матрица: графики, формулы, динамика, 2D/3D. Каждый: цель/аудитория, допущения/источники, engine/version, оригиналы/лицензии, capabilities, ожидаемые числа/поведение, кадры/таймкоды, playback/interaction scenario, fallback и авторское утверждение. Не требовать все движки для каждой сцены. GPU visual tolerances + behavior assertions.

| Этап | Результат | Приёмка |
|---|---|---|
| 0 | Контрольная сборка, спецификация, исходные эталоны | Все старые функции; без Python; исходники и v1 storage сохранены |
| 1 | Отдельный GX Pages experiment | Реальное v0.1.1, sandbox, stop/fallback, отчёт/замеры |
| 2 | EngineAdapterV1, Canvas/GX, проекты/revisions, AI | Backward compatibility, no source loss, AI review/cancel, 15 шаблонов |
| 3 | Publication Manager/viewer/gallery/export/Actions | Statuses/deploy/rollback/links/licenses/no secrets, 30 шаблонов |
| 4 | JS/TS/JSON labs, educational graph/validation | Isolation/parameters/reset/results/transitions, 40 шаблонов |
| 5 | CE/GL and QuizFlow22 bridge | Security/trust/export/benchmarks, 50 шаблонов |

Validation interface на этапе 2, approval автора на этапе 3; сложные научные валидаторы не блокируют этапы. QuizFlow22: versioned bridge + stub round-trip без потерь; реальная совместимость только после спецификации/совместного прототипа.

Переход запрещён до приёмки предыдущего этапа. Каждый этап оставляет собираемую/публикуемую Studio. Возможности добавляются, не удаляются. Canvas p95 regression ≤10% на одинаковом стенде. Cold/warm/first-frame/seek/cancel/export измеряются отдельно. Открытые критерии не объявлять выполненными.
