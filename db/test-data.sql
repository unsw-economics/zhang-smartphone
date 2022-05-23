truncate subjects cascade;
truncate reports cascade;

insert into study_dates(period_name, baseline_date, treatment_date, endline_date, over_date, is_default) values 
  ('22T1_testing', '2022-01-06', '2022-01-17', '2022-02-14', '2022-02-21', false),
  ('22T1', '2022-02-14', '2022-02-27', '2022-03-27', '2022-04-10', false),
  ('22T2_testing', '2022-05-19', '2022-05-21', '2022-05-24', '2022-05-26', false),
  ('22T2', '2022-05-26', '2022-06-10', '2022-07-08', '2022-07-22', false),
  ('generic_testing_data', '2022-01-01', '2022-01-01', '2022-01-01', '2022-01-01', true),
  ('future_dates_for_testing', '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', false),
  ('always_treatment_for_testing', '2022-01-01', '2022-01-02', '2023-01-01', '2023-01-02', false),
  ('use_hardcoded_dates', null, null, null, null, false);

insert into subjects (subject_id, email, secret, test_group, treatment_intensity, treatment_limit) values
  ('aaaaaa000000', 'raphaeljmu@gmail.com', 'kzVs3AvG-nFLV3vZEzenT', 0, null, null),
  ('aaaaaa000001', 'raphaeljmu1@gmail.com', 'kzVs3AvG-nFLV3vZEzenT', 1, null, 1800),
  ('aaaaaa000002', 'raphaeljmu2@gmail.com', 'kzVs3AvG-nFLV3vZEzenT', 2, 7, 3600),
  ('llllll000000', 'lehan.zhang@hotmail.com', '611bhdtcehsQIT4N4rNse', 0, null, null),
  ('llllll000001', 'lehan.zhang1@hotmail.com', '611bhdtcehsQIT4N4rNse', 1, null, 18000),
  ('llllll000002', 'lehan.zhang2@hotmail.com', '611bhdtcehsQIT4N4rNse', 2, 7, 7200),
  ('jjjjjj000000', 'jane.zhang@unsw.edu.au', '3fEt6MEL94jy8dUS8s4YC', 0, null, null),
  ('jjjjjj000001', 'jane.zhang1@unsw.edu.au', '3fEt6MEL94jy8dUS8s4YC', 1, null, 3600),
  ('jjjjjj000002', 'jane.zhang2@unsw.edu.au', '3fEt6MEL94jy8dUS8s4YC', 2, 7, 7200),
  ('zzzzzzzzzzzz', 'test@gmail.com', 'zzzzzzzzzzzzzzzzzzzzz', null, null, null);

insert into subjects (subject_id, email, secret, test_group, treatment_intensity, treatment_limit, study_group) values
  ('a', 'imlazya@email.com', 'secretsecretsecretsec', 0, null, null, '22T2'),
  ('b', 'imlazyb@email.com', 'secretsecretsecretsec', 1, null, 80000, '22T2'),
  ('c', 'imlazyc@email.com', 'secretsecretsecretsec', 2, 10, 80000, '22T2'),
  ('subjectid1', 'example@email.com', 'secretsecretsecretsec', 0, null, null, 'use_hardcoded_dates'),
  ('futureid', 'future@email.com', 'secretsecretsecretsec', 0, null, null, 'future_dates_for_testing'),
  ('info', 'info@email.com', 'secretsecretsecretsec', 1, null, 80000, 'always_treatment_for_testing'),
  ('incentive', 'incentive@email.com', 'secretsecretsecretsec', 2, 10, 80000, 'always_treatment_for_testing'),
  ('subjectid2', 'testing@gmail.com', 'secretsecretsecretsec', 1, null, 1800, 'use_hardcoded_dates');

insert into reports (subject_id, application_name, period, day, usage) values
  ('zzzzzzzzzzzz', 'com.instagram.android', 'baseline', 0, 100),
  ('zzzzzzzzzzzz', 'com.facebook.katana', 'baseline', 0, 100);


