select subject_id, period, day, sum(usage) from reports group by subject_id, period, day order by period, subject_id, day;
