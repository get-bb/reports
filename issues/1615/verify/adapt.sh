cd /tmp/bb-reports/issues/1615/verify
for f in step2-changed-files-banner step4-open-csv step6-path-browser step5b-measure-csv-prod; do
  sed -e 's#localhost:15271#localhost:15040#g; s#localhost:15272#localhost:15041#g; s#proj_drg6kwky3m#proj_uy6nvf8nfy#g; s#thr_5e4dmaajwp#thr_pm9wxhqkwb#g; s#/tmp/1615-qa/#/tmp/1615-qa-verify/#g; s#"1615-#"1615-verify-#g' ../repro/$f.js > $f.js
done
ls
