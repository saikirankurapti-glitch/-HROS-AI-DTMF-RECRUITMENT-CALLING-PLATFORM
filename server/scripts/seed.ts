import {openDatabase} from '../src/db.js';
const db=openDatabase();
const examples=[
 ['Example One','+15550101001','one@example.invalid','Data Engineer','interested'],
 ['Example Two','+15550101002','two@example.invalid','Data Engineer','not_interested'],
 ['Example Three','+15550101003','three@example.invalid','Data Engineer','no_input'],
 ['Example Four','+15550101004','four@example.invalid','Data Engineer','busy'],
 ['Example Five','+15550101005','five@example.invalid','Data Engineer','failed']
];
for(const c of examples)db.prepare("INSERT OR IGNORE INTO candidates(name,phone,email,role,scenario,consent,consent_at,consent_source) VALUES(?,?,?,?,?,1,?,'synthetic-test-data')")
 .run(c[0],c[1],c[2],c[3],c[4],new Date().toISOString());
console.log('Seeded fictional candidates only; no real phone numbers used');
db.close();
