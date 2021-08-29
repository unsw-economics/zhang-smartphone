drop table if exists subjects;

create table subjects (
  id serial primary key not null,
  subject_id char(6) not null,
  test_group integer not null,
  first_name varchar(35) not null,
  last_name varchar(35) not null,
  email varchar(120) not null
);

create unique index subjects_subject_id on subjects (subject_id);
create index subjects_test_group on subjects (test_group);

drop table if exists reports;

create table reports (
  id serial primary key not null,
  subject_id char(6) not null,
  application_id varchar(100) not null,
  report_date date not null,
  foreground_time integer not null,
  visible_time integer not null,
  constraint fk_subject_id foreign key (subject_id) references subjects(subject_id)
);

create index reports_subject_id on reports (subject_id);
create index reports_application_id on reports (application_id);

-- foreground_time and visible_time in seconds

