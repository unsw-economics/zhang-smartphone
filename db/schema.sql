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

drop view if exists usage_view;
create or replace view usage_view as 
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
    -- Calculate days since the start of the period from the date reported
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
  group by u.subject_id, date_reported, study_group, d.baseline_date, d.treatment_date, d.endline_date, d.over_date
  order by study_group, u.subject_id, date_reported asc;
