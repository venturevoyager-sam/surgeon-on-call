# Backend

- Express.js 5 REST API, Node.js, CommonJS
- Supabase PostgreSQL, Twilio WhatsApp+SMS, Nodemailer Gmail, Winston logging, node-cron
- No auth middleware — all routes open
- Run: `cd backend && npm install && npm start` (port 5000)
- Deploy: Render Web Service, Singapore, `render.yaml`

## Cases `/api/cases`

| Method | Path | Action | Body/Params | Response |
|--------|------|--------|-------------|----------|
| POST | `/api/cases/draft` | create draft case | `{hospital_id, pre_assigned_surgeon, request_type?, fee?}` | `{case}` |
| POST | `/api/cases` | create case + run matching | `{hospital_id, procedure, specialty_required, surgery_date, surgery_time, duration_hours, ot_number, patient_name, patient_age, patient_gender, fee, request_type?, parent_case_id?, notes?, documents?}` | `{case, matched_surgeons[], skip_shortlist}` |
| GET | `/api/cases` | list hospital cases | `?hospital_id=` | `{cases[]}` |
| GET | `/api/cases/:id` | case detail + priority list | | `{case, priority_list[], skip_shortlist}` |
| GET | `/api/cases/:id/matches` | re-run matching | | `{matched_surgeons[]}` |
| PATCH | `/api/cases/:id` | update case fields | partial case fields | `{case}` |
| PATCH | `/api/cases/:id/priority` | save priority list, trigger cascade | `{priority_list: [surgeon_ids]}` | `{case_id}` |
| DELETE | `/api/cases/:id` | delete case + priority rows | | `{message}` |
| GET | `/api/cases/:caseId/surgeon-view` | case for surgeon (city only until confirmed) | `?surgeon_id=` | `{case}` |
| PATCH | `/api/cases/:caseId/accept` | surgeon accepts | `{surgeon_id}` | `{message}` 409 if taken |
| PATCH | `/api/cases/:caseId/decline` | surgeon declines, triggers cascade | `{surgeon_id}` | `{message}` |
| POST | `/api/cases/:caseId/recommend` | surgeon recommends surgery (reconsult) | `{surgeon_id, suggested_procedure, urgency, recommendation_notes?}` | `{recommendation}` |
| GET | `/api/cases/:caseId/recommendation` | get recommendation | | `{recommendation}` |
| PATCH | `/api/cases/:caseId/convert` | convert reconsult to surgery | `{hospital_id}` | `{case_id}` |

## Surgeons `/api/surgeons`

| Method | Path | Action | Body/Params | Response |
|--------|------|--------|-------------|----------|
| POST | `/api/surgeons/register` | register (verified:false, default pw:'password') | `{name, phone, mci_number, city, specialty[]?, email?, ...30+ optional fields}` | `{surgeon_id, name}` 409 if phone exists |
| POST | `/api/surgeons/login` | phone+pw login (auto-creates if new) | `{phone, password}` | `{surgeon_id, name, phone, verified, available}` |
| GET | `/api/surgeons/:id` | profile | | `{surgeon}` |
| PATCH | `/api/surgeons/:id/availability` | toggle | `{available: bool}` | `{available}` |
| GET | `/api/surgeons/:id/requests` | incoming + upcoming | | `{incoming_requests[], upcoming_cases[]}` |
| GET | `/api/surgeons/:id/earnings` | completed cases | | `{earnings[]}` each has `gross_fee, commission_amount(5%), net_payout` |
| PATCH | `/api/surgeons/:id/profile` | partial update | any surgeon fields | `{surgeon}` |
| PATCH | `/api/surgeons/:id/password` | change pw | `{current_password, new_password}` | `{message}` |

## Hospitals `/api/hospitals`

| Method | Path | Action | Body/Params | Response |
|--------|------|--------|-------------|----------|
| POST | `/api/hospitals/register` | register (verified:false) | `{name, address, city, contact_name, contact_email, contact_phone, password, lat?, lng?, bed_count?, hospital_type?}` | `{hospital}` 409 if email exists |
| POST | `/api/hospitals/login` | email+pw login | `{email, password}` | `{hospital_id, hospital_name, verified}` |
| PATCH | `/api/hospitals/:id/password` | change pw | `{current_password, new_password}` | `{message}` |

## Admin `/api/admin`

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/stats` | platform stats + hospital breakdown |
| GET | `/api/admin/cases` | all cases — `?status=` `?search=` |
| GET | `/api/admin/surgeons` | all surgeons — `?available=` `?search=` |
| GET | `/api/admin/hospitals` | all hospitals + case counts |
| GET | `/api/admin/earnings` | commission report (5%+5%=10%) |
| PATCH | `/api/admin/cases/:id/override` | assign surgeon, bypass cascade — `{surgeon_id}` |
| PATCH | `/api/admin/cases/:id/status` | update status — `{status}` |
| PATCH | `/api/admin/cases/:id/reassign` | reassign confirmed case — `{surgeon_id}` |
| POST | `/api/admin/cases/:id/cascade` | manually trigger next cascade step |
| PATCH | `/api/admin/surgeons/:id/verify` | verify/reject — `{action: verify|reject}` |
| PATCH | `/api/admin/surgeons/:id/suspend` | suspend/reactivate — `{action}` |
| PATCH | `/api/admin/surgeons/:id/profile` | edit surgeon fields |
| PATCH | `/api/admin/hospitals/:id/verify` | verify hospital — `{verified: bool}` |

## Specialties

| GET | `/api/specialties` | list active specialties | | `{specialties[]}` |

## Matching Algorithm — `matchSurgeons()` in `src/routes/cases.js`

- Filter: `verified=true`, `available=true`, `status=active`, specialty contains required
- Exclude: surgeons with confirmed/in_progress case on same date
- Distance: haversine, exclude if > `travel_radius_km` (default 10km)
- Score (max 120): proximity 0–50 (`50 - dist*2`, neutral 25 if no coords) + rating 0–50 (`rating*10`) + experience 0–20 (`min(total_cases/10, 20)`)
- Limit: 7 (default), 0 (unlimited) for emergency

## Cascade

- Normal: notifies surgeons one-by-one, 2hr expiry, `triggerCascade()` on decline
- Emergency: `broadcastEmergency()` notifies ALL at once, first accept wins
- No automated expiry — relies on decline or admin intervention
- Notifications: WhatsApp primary (Twilio sandbox), SMS fallback

## Env Vars

`PORT`(5000), `SUPABASE_URL`(req), `SUPABASE_ANON_KEY`(req), `TWILIO_ACCOUNT_SID`(req), `TWILIO_AUTH_TOKEN`(req), `TWILIO_PHONE_NUMBER`(req), `TWILIO_WHATSAPP_NUMBER`(req), `GMAIL_USER`(opt), `GMAIL_APP_PASSWORD`(opt — email degrades gracefully)
