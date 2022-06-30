drop table if exists study_dates cascade;
drop table if exists subjects cascade;
drop table if exists reports cascade;
drop table if exists crash_reports cascade;
drop table if exists usage_backup cascade;

drop type if exists report_period;

create table study_dates (
  id serial primary key not null,
  period_name varchar(100) not null, -- Name of the study period eg. "22T2", "22T2_test", "testing"
  baseline_date date,
  treatment_date date,
  endline_date date,
  over_date date,
  is_default boolean not null default false, -- If no study_dates are specified, the default will be null. Otherwise, the first one with this flag is the default
  -- Constraint makes sure that either all the dates are valid and are correctly ordered or dates are all null
  constraint valid_dates
    check ((baseline_date is null and treatment_date is null and endline_date is null and over_date is null) 
    or (baseline_date <= treatment_date and treatment_date <= endline_date and endline_date <= over_date)),
  unique(period_name)
);

create table subjects (
  id serial primary key not null,
  subject_id char(12) not null,
  email varchar(120) not null,
  secret char(21) not null,
  identified boolean not null default false,
  test_group int,
  treatment_intensity int,
  treatment_limit int, -- seconds
  study_group varchar(100) references study_dates(period_name) default null,
  date_inserted timestamp default (current_timestamp at time zone 'Australia/Sydney'),
  unique (subject_id),
  unique (email)
);

create unique index subjects_subject_id on subjects (subject_id);
create index subjects_test_group on subjects (test_group);

-- Trigger to assign the default study group to a subject if none is specified
create or replace function study_group_default() returns trigger
as $$
begin
if new.study_group is null then
  new.study_group = (select period_name from study_dates where is_default = true limit 1);
end if;
return new;
end;
$$ language plpgsql;

create or replace trigger default_study_group before insert on subjects
  for each row execute procedure study_group_default();

-- null secret means the user has not identified
-- test_group to be assigned once all subject surveys collected

create type report_period as enum ('baseline', 'experiment', 'endline');

create table reports (
  id serial primary key not null,
  subject_id char(12) not null,
  application_name varchar(100) not null,
  period report_period not null,
  day int not null,
  usage int not null, -- seconds
  constraint fk_subject_id foreign key (subject_id) references subjects(subject_id),
  unique (subject_id, application_name, period, day)
);

create index reports_subject_id on reports (subject_id);
create index reports_application_name on reports (application_name);

create table crash_reports (
  id serial primary key not null,
  subject_id char(12),
  report text not null
);

create index crash_reports_subject_id on crash_reports (subject_id);

create table usage_backup (
  id serial primary key not null,
  subject_id char(12) not null,
  date_inserted timestamp not null default (current_timestamp at time zone 'Australia/Sydney'),
  date_reported date not null,
  usage int not null -- seconds
);

drop view if exists simple_usage_view cascade;
create or replace view simple_usage_view as 
  select 
    u.subject_id, 
    study_group, 
    date_reported, 
    max(usage) as usage,
    case
      when date_reported < d.treatment_date then 'baseline'
      when date_reported < d.endline_date then 'experiment'
      when date_reported < d.over_date then 'endline'
      else 'over'
    end as period,
    case 
      when date_reported < d.treatment_date then (date_reported - d.baseline_date)::int
      when date_reported < d.endline_date then (date_reported - d.treatment_date)::int
      when date_reported < d.over_date then (date_reported - d.endline_date)::int
      else (date_reported - d.over_date)::int
    end as day
  from usage_backup u 
  join subjects s 
  on u.subject_id=s.subject_id 
  join study_dates d
  on s.study_group=d.period_name
  group by 
    u.subject_id, 
    date_reported, 
    study_group, 
    d.baseline_date, 
    d.treatment_date, 
    d.endline_date, 
    d.over_date
  order by study_group, u.subject_id, date_reported asc;

drop view if exists detailed_usage_view cascade;
create or replace view detailed_usage_view as 
  select 
    r.subject_id, 
    s.study_group,
    r.period, 
    r.day,
    sum(r.usage) as usage
  from reports r join subjects s on s.subject_id=r.subject_id
  group by r.subject_id, period, day, s.study_group
  order by period, r.subject_id, day;

drop view if exists detailed_usage_view_w_date cascade;
create or replace view detailed_usage_view_w_date as 
  select d.*, 
    (case 
      when period='baseline' then sd.baseline_date + (d.day || ' days')::interval
      when period='experiment' then sd.treatment_date + (d.day || ' days')::interval
      when period='endline' then sd.endline_date + (d.day || ' days')::interval
      else null
    end) as date_reported 
  from detailed_usage_view d 
  join study_dates sd 
  on sd.period_name=d.study_group;

drop view if exists usage_view cascade;
create or replace view usage_view as 
  select 
    coalesce(d.subject_id, s.subject_id) as subject_id,
    coalesce(d.study_group, s.study_group) as study_group,
    coalesce(d.period::text, s.period) as period,
    coalesce(d.day, s.day) as day,
    coalesce(s.date_reported, d.date_reported) as date_reported,
    s.usage as simple_usage,
    d.usage as detailed_usage,
    (case 
      when d.usage is null then s.usage
      else d.usage
    end) as usage
  from detailed_usage_view_w_date d 
  full join simple_usage_view s 
  on d.subject_id=s.subject_id 
  and d.period::text=s.period 
  and d.day=s.day;

drop view if exists subjects_view cascade;
create or replace view subjects_view as 
  select 
    s.id,
    s.subject_id, 
    s.email, 
    s.identified, 
    s.test_group, 
    s.treatment_intensity, 
    s.treatment_limit, 
    s.study_group,
    s.date_inserted,
    max(u.date_inserted) as last_activity
  from subjects s 
  left outer join usage_backup u 
  on s.subject_id=u.subject_id
  group by 
    s.id,
    s.subject_id, 
    s.email, 
    s.identified, 
    s.test_group, 
    s.treatment_intensity, 
    s.treatment_limit, 
    s.study_group
  order by s.study_group, s.id;

-- Baseline
drop view if exists baseline_view cascade;
create or replace view baseline_view as 
  select 
    s.subject_id, 
    count(case usage when 0 then null else 1 end) as baseline_report_days,
    case 
      when count(case usage when 0 then null else 1 end) = 0 then 0 
      else (sum(usage) / count(case usage when 0 then null else 1 end))::int
    end as avg_baseline_usage
  from subjects s 
  left join usage_view u 
  on u.subject_id=s.subject_id 
  where s.identified=true 
  and period='baseline' 
  group by s.subject_id;

-- Experiment (Main)
drop view if exists experiement_view cascade;
create or replace view experiement_view as 
  select 
    s.subject_id, 
    (sum(usage) / count(usage))::int as avg_treatment_usage,
    count(usage) as treatment_report_days,
    count(case when u.usage <= s.treatment_limit then 1 else null end) as days_under_limit
  from subjects s 
  left join usage_view u 
  on u.subject_id=s.subject_id 
  where s.identified=true 
  and period='experiment' 
  group by s.subject_id, s.treatment_limit;

-- Combine all the views together
drop view if exists summary_view cascade;
create or replace view summary_view as 
  select 
    s.subject_id, 
    s.test_group,
    coalesce(avg_treatment_usage, 0) as avg_treatment_usage,
    coalesce(treatment_report_days, 0) as treatment_report_days,
    coalesce(days_under_limit, 0) as days_under_limit,
    avg_baseline_usage,
    baseline_report_days,
    date_inserted as latest_sign_in,
    s.study_group
  from subjects s 
  left join baseline_view b on b.subject_id=s.subject_id 
  left join experiement_view e on e.subject_id=s.subject_id 
  where identified=true
  order by treatment_report_days desc, baseline_report_days desc, s.subject_id;

-- Function to calculate usage between given dates inclusive
drop function if exists calculate_usage cascade;
create or replace function calculate_usage(start_date date, end_date date)
  returns table(subject_id char(12), 
    test_group int,
    avg_treatment_usage int,
    treatment_report_days bigint,
    days_under_limit bigint,
    avg_baseline_usage int,
    baseline_report_days bigint,
    latest_sign_in timestamp,
    study_group varchar(100))
  as $$
begin
  return query
  select 
    s.subject_id, 
    s.test_group,
    coalesce(e.avg_treatment_usage, 0) as avg_treatment_usage,
    coalesce(e.treatment_report_days, 0) as treatment_report_days,
    coalesce(e.days_under_limit, 0) as days_under_limit,
    b.avg_baseline_usage,
    b.baseline_report_days,
    date_inserted as latest_sign_in,
    s.study_group
  from subjects s 
  left outer join (select 
    s.subject_id, 
    count(case usage when 0 then null else 1 end) as baseline_report_days,
    case 
      when count(case usage when 0 then null else 1 end) = 0 then 0 
      else (sum(usage) / count(case usage when 0 then null else 1 end))::int
    end as avg_baseline_usage
  from subjects s 
  left join usage_view u 
  on u.subject_id=s.subject_id 
  where s.identified=true 
  and period='baseline'
  group by s.subject_id
) as b on b.subject_id=s.subject_id 
  left outer join (select 
    s.subject_id, 
    (sum(usage) / count(usage))::int as avg_treatment_usage,
    count(usage) as treatment_report_days,
    count(case when u.usage <= s.treatment_limit then 1 else null end) as days_under_limit
  from subjects s 
  join usage_view u 
  on u.subject_id=s.subject_id 
  where s.identified=true 
  and period='experiment'
  and u.date_reported between start_date and end_date
  group by s.subject_id, s.treatment_limit
) as e on e.subject_id=s.subject_id 
  where identified=true
  order by treatment_report_days desc, baseline_report_days desc, s.subject_id;
end; $$ language plpgsql;
