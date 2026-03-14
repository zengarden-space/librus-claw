# librus-claw

[OpenClaw](https://openclaw.ai) plugin for [Librus Synergia](https://synergia.librus.pl) — the Polish school e-gradebook.

Adds AI tools to OpenClaw so it can answer natural language questions about school data: grades, attendance, homework, timetable, and messages — in any language the user speaks.

## Tools registered

| Tool | What it does |
|---|---|
| `get_librus_grades` | Grades by subject with weighted averages |
| `get_librus_attendance` | Absence records and counts per subject |
| `get_librus_homework` | Upcoming assignments sorted by due date |
| `get_librus_timetable` | Weekly class schedule |
| `get_librus_messages` | Inbox messages from teachers |
| `get_librus_announcements` | School announcements |

## Installation

### 1. Clone the plugin

```bash
git clone https://github.com/zengarden-space/librus-claw
cd librus-claw
npm install
```

### 2. Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json5
{
  "plugins": {
    "allow": ["librus-claw"],
    "load": {
      "paths": ["/path/to/librus-claw"]
    },
    "entries": {
      "librus-claw": {
        "config": {
          "username": "your-librus-login",
          "password": "your-librus-password"
        }
      }
    }
  }
}
```

### 3. Restart OpenClaw gateway

```bash
openclaw gateway restart
```

## Usage

Ask OpenClaw naturally:

- *"What are my grades?"* → calls `get_librus_grades`
- *"Do I have any homework this week?"* → calls `get_librus_homework`
- *"What lessons do I have tomorrow?"* → calls `get_librus_timetable`
- *"Am I at risk of failing due to absences?"* → calls `get_librus_attendance`
- *"Any new messages from teachers?"* → calls `get_librus_messages`

Works in Polish too: *"Jakie mam oceny z matematyki?"*

## Live testing

Test against real credentials before connecting to OpenClaw:

```bash
cp .env.example .env
# Edit .env with your Librus username and password
npm run test:live

# Show first 500 chars of each response:
npm run test:live:verbose
```

The `.env` file is gitignored — credentials never leave your machine.

## Type checking

```bash
npm run typecheck
```

## Polish grade scale

| Grade | Polish | Meaning |
|---|---|---|
| 6 | celujący | outstanding |
| 5 | bardzo dobry | very good |
| 4 | dobry | good |
| 3 | dostateczny | satisfactory |
| 2 | dopuszczający | acceptable |
| 1 | niedostateczny | failing |

A weighted average below 2.0 in any subject means the student is at risk of failing (nieklasyfikowanie).

## License

MIT
