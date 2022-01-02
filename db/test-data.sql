truncate subjects cascade;
truncate reports cascade;

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

insert into reports (subject_id, application_name, period, day, usage) values
  ('zzzzzzzzzzzz', 'com.instagram.android', 'baseline', 0, 100),
  ('zzzzzzzzzzzz', 'com.facebook.katana', 'baseline', 0, 100);


