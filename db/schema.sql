drop table if exists subjects cascade;
drop table if exists reports cascade;
drop type if exists report_period;

create table subjects (
  id serial primary key not null,
  subject_id char(12) not null,
  email varchar(120) not null,
  secret char(21) not null,
  test_group int,
  unique (subject_id),
  unique (email)
);

create unique index subjects_subject_id on subjects (subject_id);
create index subjects_test_group on subjects (test_group);

-- null secret means the user has not identified
-- test_group to be assigned once all subject surveys collected

create type report_period as enum ('baseline', 'experiment');

create table reports (
  id serial primary key not null,
  subject_id char(12) not null,
  application_name varchar(100) not null,
  period report_period not null,
  day int not null,
  usage_seconds int not null,
  constraint fk_subject_id foreign key (subject_id) references subjects(subject_id),
  unique (subject_id, application_name, period, day)
);

create index reports_subject_id on reports (subject_id);
create index reports_application_name on reports (application_name);

