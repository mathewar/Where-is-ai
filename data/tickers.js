// Stock listings for companies in the map, keyed by node id.
// co: listed company; rel: own | parent (owned by) | operator (operated/built by) | part (part-owned by);
// l: [symbol, exchange] in Google Finance codes; st: 'proposed' for an announced listing not yet trading.
// Ids that are not in NODES are ignored, so entries can be added before a node exists.
const TICKERS = (()=>{
  const T={}, set=(ids,co,rel,l,extra)=>ids.split(' ').forEach(id=>T[id]=Object.assign({co,rel,l},extra||{}));
  // Labs
  set('anthropic','Anthropic','own',[['ANT','NASDAQ']],{st:'proposed',note:'IPO pricing expected Nov 18, 2026; trading expected Nov 19',src:'https://fourweekmba.com/ai-anthropics-ipo-day-by-day-pricing-18-nov-trading-19-nov/'});
  set('zhipu','Knowledge Atlas (Zhipu AI)','own',[['2513','HKG']]);
  set('minimax','MiniMax','own',[['0100','HKG']]);
  set('meta mtia prometheus hyperion','Meta Platforms','parent',[['META','NASDAQ']]);
  set('xai colossus1 colossus2 memphis_gas southaven_gas','SpaceX','parent',[['SPCX','NASDAQ']]);
  // Clouds and their sites
  set('aws rainier aws_susq trainium','Amazon','parent',[['AMZN','NASDAQ']]);
  set('deepmind gcp tpu gcp_cb gcp_dalles gcp_mayes','Alphabet','parent',[['GOOGL','NASDAQ']]);
  set('azure fairwater_wi fairwater_atl','Microsoft','parent',[['MSFT','NASDAQ']]);
  set('oracle','Oracle','own',[['ORCL','NYSE']]);
  set('abilene shackelford donaana portwash saline','Oracle','operator',[['ORCL','NYSE']]);
  set('lordstown milam','SoftBank Group','operator',[['9984','TYO']]);
  set('coreweave','CoreWeave','own',[['CRWV','NASDAQ']]);
  set('nebius','Nebius','own',[['NBIS','NASDAQ']]);
  set('stargate_norway','Aker ASA','part',[['AKER','OSL']]);
  set('qwen alicloud thead alibaba_zhangbei alibaba_ulanqab alibaba_hz alibaba_nantong','Alibaba','parent',[['BABA','NYSE'],['9988','HKG']]);
  set('tencentcloud','Tencent','parent',[['0700','HKG']]);
  set('lambda_tx','Hut 8','operator',[['HUT','NASDAQ']]);
  // Chips, memory, fabs, tools, materials
  set('nvidia','Nvidia','own',[['NVDA','NASDAQ']]);
  set('amd','AMD','own',[['AMD','NASDAQ']]);
  set('broadcom','Broadcom','own',[['AVGO','NASDAQ']]);
  set('cerebras','Cerebras','own',[['CBRS','NASDAQ']]);
  set('mediatek','MediaTek','own',[['2454','TPE']]);
  set('alchip','Alchip','own',[['3661','TPE']]);
  set('cambricon','Cambricon','own',[['688256','SHA']]);
  set('skhynix','SK hynix','own',[['000660','KRX']]);
  set('samsung_mem','Samsung Electronics','parent',[['005930','KRX']]);
  set('micron_boise','Micron','own',[['MU','NASDAQ']]);
  set('tsmc_hsinchu','TSMC','own',[['TSM','NYSE'],['2330','TPE']]);
  set('tsmc_tainan tsmc_cowos tsmc_az','TSMC','parent',[['TSM','NYSE'],['2330','TPE']]);
  set('smic','SMIC','own',[['0981','HKG'],['688981','SHA']]);
  set('asml','ASML','own',[['ASML','NASDAQ'],['ASML','AMS']]);
  set('cymer','ASML','parent',[['ASML','NASDAQ'],['ASML','AMS']]);
  set('shinetsu','Shin-Etsu Chemical','parent',[['4063','TYO']]);
  set('sumco','SUMCO','own',[['3436','TYO']]);
  // Power and fuel
  set('susquehanna','Talen Energy','parent',[['TLN','NASDAQ']]);
  set('tmi','Constellation Energy','parent',[['CEG','NASDAQ']]);
  set('duane_arnold','NextEra Energy','parent',[['NEE','NYSE']]);
  set('holtwood','Brookfield Renewable','parent',[['BEP','NYSE']]);
  set('changhua_wind','Ørsted','parent',[['ORSTED','CPH']]);
  set('caterpillar','Caterpillar','own',[['CAT','NYSE']]);
  set('solaris','Solaris Energy Infrastructure','own',[['SEI','NYSE']]);
  set('hyperion_gas','Entergy','operator',[['ETR','NYSE']]);
  set('socrates','Williams','operator',[['WMB','NYSE']]);
  set('kazatomprom','Kazatomprom','own',[['KAP','LON']]);
  set('cameco','Cameco','operator',[['CCJ','NYSE']]);
  return T;
})();
