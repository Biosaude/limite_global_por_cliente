import openpyxl, collections, datetime, decimal, json, hashlib, pathlib, sys
P=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.local/official.xlsx')
w=openpyxl.load_workbook(P,data_only=True); report={'sha256':hashlib.sha256(P.read_bytes()).hexdigest(),'sheets':[]}; allrows=[]
D=decimal.Decimal
for s in w:
 rows=list(s.values); headers=rows[0]; band='received' if 'RECEBIDO' in s.title else 'overdue' if 'VENCIDO' in s.title else 'upcoming'
 idx=14 if band=='received' else 13
 total=sum((D(str(r[idx])) for r in rows[1:]),D(0))
 keys=collections.defaultdict(list); implied=collections.Counter(); issues=[]; amounts=[]
 for line,r in enumerate(rows[1:],2):
  key=(r[0].strip(),str(r[1]),str(r[2])); keys[key].append(line)
  a=D(str(r[idx])); amounts.append(a)
  if a<=0: issues.append({'row':line,'code':'NONPOSITIVE_AMOUNT','value':str(a)})
  if band!='received': implied[(r[4]+datetime.timedelta(days=r[5])).date().isoformat()]+=1
  if band=='upcoming' and r[4].date()<=datetime.date(2026,10,19):issues.append({'row':line,'code':'BAND_DATE_CONFLICT','due':r[4].date().isoformat(),'amount':str(a)})
  if band=='received' and r[5]<r[3]:issues.append({'row':line,'code':'RECEIVED_BEFORE_ISSUE'})
  if band=='received' and r[11]!=r[5]:issues.append({'row':line,'code':'CREDIT_DATE_DIFFERS'})
  allrows.append({'band':band,'sheet':s.title,'row':line,'key':key,'amount':str(a),'face':str(r[12 if band=='received' else 11]),'discount':str(r[13 if band=='received' else 12]),'due':r[4].date().isoformat(),'received':r[5].date().isoformat() if band=='received' else None})
 cols=[]
 for i,h in enumerate(headers):
  v=[r[i] for r in rows[1:]]; dates=[x for x in v if isinstance(x,datetime.datetime)]
  cols.append({'position':i+1,'name':h,'types':dict(collections.Counter(type(x).__name__ for x in v)),'nullOrBlank':sum(x is None or isinstance(x,str) and not x.strip() for x in v),'dateRange':[min(dates).date().isoformat(),max(dates).date().isoformat()] if dates else None})
 report['sheets'].append({'name':s.title,'band':band,'records':len(rows)-1,'columns':cols,'financialColumn':{'position':idx+1,'name':headers[idx]},'total':str(total),'duplicateTitleKeys':[{'key':k,'rows':v} for k,v in keys.items() if len(v)>1],'impliedReferenceDates':dict(implied),'issues':issues,'nonPositive':sum(a<=0 for a in amounts)})
bykey=collections.defaultdict(list)
for r in allrows:bykey[r['key']].append(r)
report['crossSheet']=[{'key':k,'records':v} for k,v in bykey.items() if len(set(x['band'] for x in v))>1]
report['monthlyReceived']={m:str(sum((D(r['amount']) for r in allrows if r['band']=='received' and r['received'][:7]==m),D(0))) for m in sorted(set(r['received'][:7] for r in allrows if r['received']))}
report['globalRaw']=str(sum((D(x['total']) for x in report['sheets']),D(0)))
pathlib.Path(sys.argv[2] if len(sys.argv)>2 else '.local/independent-audit.private.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
for s in report['sheets']:
 print(s['band'],s['records'],s['total'],'duplicates',len(s['duplicateTitleKeys']),'impliedDates',s['impliedReferenceDates'],'issues',dict(collections.Counter(i['code'] for i in s['issues'])))
print('CROSS SHEET',len(report['crossSheet']),dict(collections.Counter(tuple(sorted(set(r['band'] for r in c['records']))) for c in report['crossSheet'])))
print('MONTHS',report['monthlyReceived'],'GLOBAL RAW',report['globalRaw'])
print('CONFLICT AMOUNT',sum((D(i['amount']) for s in report['sheets'] for i in s['issues'] if i['code']=='BAND_DATE_CONFLICT'),D(0)))
