const p=require('/app/frontend/node_modules/@babel/parser');const fs=require('fs');
for(const f of process.argv.slice(2)){try{p.parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['typescript','jsx']});console.log('OK',f)}catch(e){console.log('ERR',f,e.message)}}
