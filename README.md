# Beatstore

Учебный проект по дисциплине «Технологии создания и поддержки программного обеспечения». Веб-магазин битов и драмкитов с тестовой оплатой, выдачей файлов и PDF-лицензий.

Автор: Поладов Михаил Заурович, группа ПИ 31/1.

## Запуск приложения

Нужен Node.js 22.12 или новее и npm 10 или новее. Проверено с Node.js 26.11.1 и npm 11.20.0 на Windows x64. На этапе DEV-01 доступны сервер и проверка подключения к PostgreSQL.

```powershell
npm ci
npm run build
npm start
```

Проверка состояния: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health). Без `DATABASE_URL` запускается локальный PostgreSQL 17.10; файлы базы и сгенерированный пароль хранятся в `.local`, которая исключена из Git. Отдельный PostgreSQL подключается через `DATABASE_URL` в `.env`. Пример настроек: [.env.example](.env.example).

Сервер: TypeScript и Express 5.3.0. Веб-интерфейс: React 19.3.1 и Vite 8.3.5. Точные версии всех зависимостей закреплены в `package-lock.json`. Docker для локального запуска не требуется.

## Документы проекта

| Папка | Содержимое |
| --- | --- |
| [diagrams](diagrams/README.md) | Актуальные UML-диаграммы, общий PDF, исходники PlantUML и SVG. Материалы прошлого семестра хранятся в подпапке archive. |
| [specification](specification/) | Актуальное ТЗ в двух форматах: [PDF](specification/beatstore-specification.pdf) и [Word](specification/beatstore-specification.docx). |
| [reports](reports/README.md) | Отчёты по спринтам, результаты актуализации, задачи разработки и соответствие требованиям. |

```text
diagrams/
  beatstore-uml.pdf
  sources/                     # исходники PlantUML
  svg/                         # изображения диаграмм
  archive/                     # UML прошлого семестра
specification/
  beatstore-specification.pdf
  beatstore-specification.docx
reports/
  project-status.md            # текущее состояние и ближайшие задачи
  sprint-01/                   # актуализация ТЗ
  sprint-02/                   # актуализация UML и декомпозиция
```

## Материалы для проверки

- [Спринт 1 — актуализация ТЗ и исходное состояние](reports/sprint-01/README.md).
- [Спринт 2 — UML и декомпозиция разработки](reports/sprint-02/README.md).
- [Текущее состояние проекта](reports/project-status.md).

ТЗ проверено, UML актуализированы, задачи разработки определены. Реализована инфраструктурная основа DEV-01; ближайший результат — каталог товаров из PostgreSQL с поиском, карточкой и демо.
