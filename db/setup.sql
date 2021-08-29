drop table if exists subjects cascade;

create table subjects (
  id serial primary key not null,
  subject_id char(6) not null,
  test_group integer,
  first_name varchar(35) not null,
  last_name varchar(35) not null,
  email varchar(120) not null,
  secret char(21)
);

create unique index subjects_subject_id on subjects (subject_id);
create index subjects_test_group on subjects (test_group);

-- null secret means the user is uninducted
-- test_group to be assigned once all subject surveys collected

drop table if exists reports cascade;

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

insert into subjects (subject_id, first_name, last_name, email) values ('abcdef', 'Raphael', 'Mu', 'raphaeljmu@gmail.com');


