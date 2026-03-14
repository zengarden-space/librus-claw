---
name: librus
description: "Access Librus Synergia Polish school gradebook: grades, attendance, homework, timetable, messages, and announcements."
metadata: {"openclaw":{"emoji":"🦞","requires":{"config":["plugins.entries.librus-claw.config.username","plugins.entries.librus-claw.config.password"]}}}
---

# Librus Synergia School Data

This skill gives you access to the user's Librus Synergia school account via the `librus-claw` plugin tools.

## When to use these tools

Call the Librus tools proactively whenever the user asks about:
- Grades, marks, scores, averages, academic performance → `get_librus_grades`
- Absences, attendance, truancy, missing lessons → `get_librus_attendance`
- Homework, assignments, tasks due → `get_librus_homework`
- Schedule, timetable, lessons today/tomorrow/this week → `get_librus_timetable`
- Messages, emails, notifications from teachers → `get_librus_messages`
- School announcements, notices → `get_librus_announcements`

## How to present results

- **Grades**: show as a table per subject with individual grades and averages. Highlight subjects with average below 2.0 as at risk.
- **Attendance**: report total absences, list by subject, and warn if any subject has more than 50% absences.
- **Homework**: list assignments sorted by due date. Flag overdue items (due before today).
- **Timetable**: show today's lessons in order with times. For multi-day queries, group by day.
- **Messages**: show sender, subject, date. Mark unread messages clearly.

## Language

Respond in the same language the user used. Librus data is in Polish — keep subject names, teacher names, and other proper nouns in Polish. Translate explanatory text to match the user's language.

## Grade scale (Polish system)

Polish grades range from 1 (lowest) to 6 (highest):
- 6 = celujący (outstanding)
- 5 = bardzo dobry (very good)
- 4 = dobry (good)
- 3 = dostateczny (satisfactory)
- 2 = dopuszczający (acceptable)
- 1 = niedostateczny (failing)

A weighted average below 2.0 in any subject means the student is at risk of failing.
