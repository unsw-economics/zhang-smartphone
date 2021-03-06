select
  subject_id, period, week, sum(usage) usage, avg(usage)::numeric(10, 2) avg_usage, count(*) days_recorded
  from (
    select
      subject_id, period, sum(usage) usage, day / 7 week
      from reports
      where day >= 0
      group by subject_id, period, day
  ) x
  group by subject_id, period, week
  order by subject_id, period, week
