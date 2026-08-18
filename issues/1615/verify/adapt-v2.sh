#!/bin/bash
cd /tmp/bb-reports/issues/1615/verify
for f in step2-changed-files-banner step4-open-csv step6-path-browser step5b-measure-csv-prod step5-measure-csv; do
  sed -e 's#localhost:15271#localhost:14231#g; s#localhost:15272#localhost:14232#g; s#proj_drg6kwky3m#proj_zfaz9fujtc#g; s#thr_5e4dmaajwp#thr_5wvm6uxwjk#g; s#/tmp/1615-qa/#/home/sawyer/.bb-dev/1615-qa-v2/#g; s#"1615-#"1615-v2-#g' ../repro/$f.js > v2-$f.js
done
ls
