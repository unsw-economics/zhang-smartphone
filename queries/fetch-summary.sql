select
  x.subject_id,
  max(test_group) test_group,
  (avg(usage) filter (where period = 'experiment'))::numeric(10, 2) avg_treatment_usage,
  count(*) filter (where period = 'experiment') treatment_report_days,
  count(*) filter (where period = 'experiment' and usage < treatment_limit) days_under_limit,
  (avg(usage) filter (where period = 'baseline'))::numeric(10, 2) avg_baseline_usage,
  count(*) filter (where period = 'baseline') baseline_report_days
  from (
    select
      subject_id,
      period,
      day,
      sum(usage) usage
      from reports
      group by subject_id, period, day
  ) x
  join subjects s on x.subject_id = s.subject_id
  group by x.subject_id
  order by x.subject_id
