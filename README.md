# GAS-APIs
APIs For GAS

Used Libs：Express,fs,body-parser,mysql

### 
---
GET :  
|Url|ReturnData|
|----|----|
|/|Message From data.json|
|/public/time|Status&Time&Version|
|/public/res/getByID/:id|Data From Mysql|  

POST :  
|Url|json|ReturnData|
|----|----|----|
|/private/testkey|apikey|Keys' Status|