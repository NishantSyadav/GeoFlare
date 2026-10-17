# Synthetic API CSV fixture

These four rows are invented and are not NASA observations. They exercise the
documented FIRMS area CSV shape with VIIRS I-4/I-5 names and no `type` column.
Expected outcome for one file: two accepted, one exact duplicate, one rejected
latitude. Missing type remains null with `missing_hotspot_type`; FRP zero stays
zero. The tests copy this fixture into temporary roots, never production data.
