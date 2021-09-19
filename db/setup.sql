drop table if exists subjects cascade;

create table subjects (
  id serial primary key not null,
  subject_id char(6) not null,
  test_group integer,
  first_name varchar(35) not null,
  last_name varchar(35) not null,
  email varchar(120) not null,
  secret char(21),
  unique (subject_id),
  unique (email)
);

create unique index subjects_subject_id on subjects (subject_id);
create index subjects_test_group on subjects (test_group);

-- null secret means the user has not identified
-- test_group to be assigned once all subject surveys collected

drop table if exists reports cascade;

create table reports (
  id serial primary key not null,
  subject_id char(6) not null,
  application_id varchar(100) not null,
  report_date date not null,
  usage_seconds integer not null,
  constraint fk_subject_id foreign key (subject_id) references subjects(subject_id),
  unique (subject_id, application_id, report_date)
);

create index reports_subject_id on reports (subject_id);
create index reports_application_id on reports (application_id);

insert into subjects (subject_id, test_group, first_name, last_name, email, secret) values
  ('abcdef', 1, 'Raphael', 'Mu', 'raphaeljmu@gmail.com', 'kzVs3AvG-nFLV3vZEzenT'),
  ('bcdefg', 0, 'Lehan', 'Zhang', 'lehan.zhang@hotmail.com', default);

insert into reports (subject_id, application_id, report_date, usage_seconds) values
  ('abcdef', 'com.instagram.android', '2021-08-30', 22),
  ('abcdef', 'com.facebook.katana', '2021-08-30', 56);

