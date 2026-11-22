// Guided tours. Each stop focuses on `at` and draws `path`, a chain of real links in data/graph.js
// (consecutive ids must be an edge from → to). Every number in a stop's text must appear in the
// notes, descriptions or source titles along its path; check with `node scripts/check-data.js`.
// {{labs}} and {{reach:id}} are filled in from the live graph, so counts stay current.
const TOURS = [
{
  id:'meta-stack', kicker:'Deep dive', title:'Meta wants to own the whole stack',
  lede:'Most labs rent their way to the frontier. Meta is trying to own every layer of it: the land, the power, the chips, even the data. It is still renting, too.',
  stops:[
    {at:'hyperion', path:['meta','hyperion'], text:'Start with the biggest thing Meta is building. Hyperion, in Richland Parish, Louisiana, is planned to scale to 5 GW, financed through a ~$27B joint venture with Blue Owl.'},
    {at:'hyperion_gas', path:['hyperion','hyperion_gas'], text:'To power it, Entergy is building 10 gas plants, ~7.5 GW in all, and Meta is paying for them. Seven of them still await regulators.'},
    {at:'pp_USA0006020', path:['meta','pp_USA0006020'], text:'Meta is buying nuclear too: 20-year deals for power from Vistra’s Perry and Davis-Besse plants in Ohio, 2,176 MW between them.'},
    {at:'nvidia', path:['meta','nvidia'], text:'For chips, Meta buys from everyone. Its February 2026 deal with Nvidia covers millions of Blackwell and Rubin GPUs, plus Grace and Vera CPUs.'},
    {at:'amd', path:['meta','amd'], text:'It also ordered up to 6 GW of custom AMD MI450s, with the first 1 GW shipping from the second half of 2026.'},
    {at:'tsmc_hsinchu', path:['meta','mtia','tsmc_hsinchu'], text:'And it designs its own. MTIA chips are co-designed with Broadcom and made at TSMC; the next generation is due in data centers in the first half of 2027.'},
    {at:'nebius', path:['meta','nebius'], text:'Even so, Meta rents. Nebius will supply up to $27B of capacity on Nvidia’s Vera Rubin systems over five years.'},
    {at:'coreweave', path:['meta','coreweave'], text:'CoreWeave has signed two Meta contracts, $14.2B and then $21B, running to December 2032.'},
    {at:'scale', path:['meta','scale'], text:'The last input is data. Meta paid $14.3B for 49% of Scale AI, and Scale’s chief executive now runs Meta’s lab.'}
  ],
  close:'Concrete, gas, nuclear, three sources of chips, two neoclouds and a data company: Meta’s bet is less a single model than a supply chain it is trying to own.'
},
{
  id:'grok-anatomy', kicker:'Deep dive', title:'What Grok is made of',
  lede:'Grok is trained in Memphis, on chips made in Taiwan, with memory from Korea and optics from Germany. The company behind it also rents its spare capacity to two rivals.',
  stops:[
    {at:'xai', path:['xai'], text:'Grok is built by the AI arm of SpaceX, which absorbed xAI in February 2026. It trains on its own clusters in Memphis.'},
    {at:'colossus2', path:['xai','colossus2'], text:'The training cluster is Colossus 2, a gigawatt-scale build of Nvidia GB200 racks near the Mississippi state line.'},
    {at:'southaven_gas', path:['colossus2','southaven_gas'], text:'Its power comes from gas turbines across the line in Southaven: mobile units now, with a permanent 1.2 GW plant under construction.'},
    {at:'nvidia', path:['colossus2','nvidia'], text:'The chips arrive as Nvidia GB200 NVL72 racks, each wiring 72 GPUs together.'},
    {at:'skhynix', path:['nvidia','skhynix'], text:'The high-bandwidth memory on those GPUs comes mostly from SK hynix in Korea, Nvidia’s largest HBM supplier.'},
    {at:'tsmc_tainan', path:['nvidia','tsmc_tainan'], text:'The Blackwell silicon itself is made at TSMC’s Fab 18, a gigafab in Tainan, Taiwan.'},
    {at:'asml', path:['tsmc_tainan','asml'], text:'Those leading-edge lines depend on EUV lithography, and only one company makes EUV machines: ASML.'},
    {at:'zeiss', path:['asml','zeiss'], text:'Inside every ASML scanner are optics from Carl Zeiss in Oberkochen, Germany. ASML owns 24.9% of the business.'},
    {at:'colossus1', path:['xai','colossus1'], text:'Back in Memphis, the first Colossus, which xAI built, is now leased in full to a rival: Anthropic.'},
    {at:'xai', path:['gcp','xai'], text:'Google rents from SpaceX as well: about 110k Nvidia GPUs at $920M a month, from October 2026 to June 2029, according to a SpaceX filing.'}
  ],
  close:'The company behind Grok is also one of the industry’s landlords. Its rivals’ models run on the same Memphis power and Taiwanese silicon.'
},
{
  id:'power', kicker:'Follow the power', title:'From a chat window to a uranium mine',
  lede:'Every answer from a frontier model is, in the end, electricity. Follow one lab’s power far enough back and the trail leaves the cloud entirely. It ends in southern Kazakhstan.',
  stops:[
    {at:'anthropic', path:['anthropic'], text:'Start with Claude. Anthropic runs on Amazon’s Trainium, Google’s TPUs and Nvidia GPUs at the same time. The biggest pipe runs to Amazon.'},
    {at:'aws', path:['anthropic','aws'], text:'Anthropic’s amended IPO filing commits $110B+ to AWS through April 2036, for up to 5 GW of capacity.'},
    {at:'aws_susq', path:['aws','aws_susq'], text:'Part of that capacity has an unusual address: a campus in Salem Township, Pennsylvania, built right beside a nuclear plant.'},
    {at:'susquehanna', path:['aws_susq','susquehanna'], text:'Talen Energy sells the campus up to 1,920 MW from Susquehanna’s 2.5 GW of reactors, through 2042. Nuclear power, wired almost straight into a data center.'},
    {at:'westinghouse', path:['susquehanna','westinghouse'], text:'Reactors burn fuel assemblies, and here the map moves from contract to inference. Westinghouse’s plant in Hopkins, South Carolina, fabricates fuel for about 10% of US electricity and is the likely supplier. No public contract names it.'},
    {at:'urenco', path:['westinghouse','urenco'], text:'The uranium inside is enriched in Eunice, New Mexico, at the only commercial enrichment plant in the US. It covers about a third of American demand.'},
    {at:'metropolis', path:['urenco','metropolis'], text:'Before it can be enriched, uranium has to be turned into a gas. One plant in the country does that: Metropolis Works, in Metropolis, Illinois.'},
    {at:'kazatomprom', path:['metropolis','kazatomprom'], text:'And the raw concentrate? Metropolis is confirmed to buy from Kazatomprom, the world’s largest uranium producer.'}
  ],
  close:'Eight stops from a chat window to a mine. {{reach:kazatomprom}} of the {{labs}} labs on this map reach this same nuclear fuel chain somewhere in their supply lines.'
},
{
  id:'cowos', kicker:'Chokepoint', title:'The building every lab needs',
  lede:'American or Chinese, open or closed, the {{labs}} labs on this map compete on almost everything. Follow their chips far enough and they converge on one place: TSMC’s advanced packaging lines in Taiwan.',
  stops:[
    {at:'tsmc_cowos', path:['tsmc_cowos'], text:'CoWoS is where a GPU die is bonded to its stacks of high-bandwidth memory. It sounds like a back-office step. In 2024–26 it was the tightest bottleneck in AI.'},
    {at:'nvidia', path:['openai','nvidia','tsmc_cowos'], text:'OpenAI’s route is the obvious one: a 10 GW letter of intent with Nvidia, whose chips are packaged here.'},
    {at:'broadcom', path:['anthropic','broadcom','tsmc_cowos'], text:'Anthropic took another road: custom Google TPUs built through Broadcom, with ~$161B of equipment leases in its IPO filing. Broadcom is the largest CoWoS customer after Nvidia.'},
    {at:'amd', path:['meta','amd','tsmc_cowos'], text:'Meta hedged with AMD, ordering up to 6 GW of custom MI450 chips. Different designer, same packaging line.'},
    {at:'alchip', path:['aws','trainium','alchip','tsmc_cowos'], text:'Even Amazon’s home-grown Trainium goes through Taiwan. The design house Alchip books CoWoS capacity on Amazon’s behalf.'},
    {at:'bytedance', path:['bytedance','broadcom','tsmc_cowos'], text:'China’s ByteDance has a custom chip project with Broadcom too, reported to be a 5nm design. If it ships, it lands on the same line.'},
    {at:'asml', path:['tsmc_hsinchu','asml'], text:'Behind TSMC sits one more single point of failure: ASML, the sole maker of EUV lithography machines. {{reach:asml}} of {{labs}} labs on the map run through it.'}
  ],
  close:'{{reach:tsmc_cowos}} of {{labs}} labs reach TSMC’s packaging lines somewhere in their chains. The AI race has many runners and very few factories.'
},
{
  id:'two-stacks', kicker:'US vs China', title:'Two stacks, one bottleneck',
  lede:'Export controls were meant to split AI into two supply chains. On this map the chains do split, and then quietly meet again.',
  stops:[
    {at:'nvidia', path:['deepseek','nvidia'], text:'DeepSeek is the clearest case. Its V3 model was trained on 2,048 Nvidia H800s.'},
    {at:'huawei_ascend', path:['deepseek','huawei_ascend'], text:'Then it changed course. V4 launched adapted to Huawei’s Ascend chips, and V5 pre-training is reportedly moving there too.'},
    {at:'zhipu', path:['zhipu','huawei_ascend'], text:'Zhipu, on the US Entity List since January 2025, trains on Ascend outright.'},
    {at:'smic', path:['huawei_ascend','smic'], text:'The domestic stack is meant to run through SMIC, China’s leading foundry, which makes 7nm-class chips without EUV machines.'},
    {at:'tsmc_hsinchu', path:['huawei_ascend','tsmc_hsinchu'], text:'But teardowns of Ascend chips found dies made by TSMC, the Taiwanese foundry where almost every non-Chinese AI chip starts.'},
    {at:'skhynix', path:['huawei_ascend','skhynix'], text:'The memory, too. The same teardowns found high-bandwidth memory from SK hynix and Samsung, the Korean makers Nvidia relies on.'},
    {at:'asml', path:['smic','asml'], text:'At the bottom of both stacks sits ASML. SMIC can buy its older DUV machines but is barred from the EUV scanners TSMC uses.'}
  ],
  close:'Two stacks on paper. On the map, both still lean on Taiwanese fabs, Korean memory and Dutch lithography.'
},
{
  id:'long-way-round', kicker:'Workarounds', title:'The long way round',
  lede:'When the most advanced Nvidia chips can’t be sold into China, compute finds other routes. This tour follows the ones that have been reported. Each is an allegation, attributed to the outlet that reported it, and most are denied.',
  stops:[
    {at:'alicloud', path:['qwen','alicloud'], text:'Start with Alibaba’s Qwen models, developed and trained inside Alibaba Cloud.'},
    {at:'litong', path:['alicloud','litong'], text:'Fortune reported that part of Alibaba’s compute comes from Shanghai Century Litong, a data-center builder that also sells capacity to Tencent.'},
    {at:'megaspeed', path:['litong','megaspeed'], text:'Litong’s chips allegedly came through Megaspeed, a Singapore neocloud reported to have moved $7.5B+ of Nvidia hardware. Megaspeed denies wrongdoing. Singapore police are investigating, and the NYT reports a US criminal inquiry.'},
    {at:'speedmatrix', path:['megaspeed','speedmatrix'], text:'The hardware ran through Megaspeed’s Malaysian subsidiary in Johor. The New York Times counted 200+ shipments of restricted Nvidia technology there between June 2024 and June 2025.'},
    {at:'thailand_dc', path:['moonshot','thailand_dc'], text:'A second route runs through Thailand, where a White House adviser alleged Moonshot used Nvidia GB300s to train Kimi K3. The operator has not been named.'},
    {at:'nvidia', path:['moonshot','nvidia'], text:'In November a former OpenAI researcher said Kimi K3’s weights match Blackwell GPUs. His analysis can’t say where the chips were, and Moonshot hasn’t commented.'},
    {at:'oracle', path:['tencentcloud','oracle'], text:'Not every route is hidden. Oracle reportedly agreed to lease Tencent ~100k Nvidia GPUs in Southeast Asia, worth about $7B over five years, then cancelled in November after US officials raised concerns (FT).'}
  ],
  close:'None of these routes appears on an export licence. All of them appear on this map, drawn dashed where they rest on reporting, with the denials one click away.'
},
{
  id:'gas-rush', kicker:'Follow the power', title:'The gas rush',
  lede:'The grid can’t connect new data centers fast enough, so the labs are bringing their own power plants. On this map, nearly all of them burn natural gas.',
  stops:[
    {at:'colossus2', path:['xai','colossus2'], text:'SpaceX’s Colossus 2 in Memphis is a gigawatt-scale cluster of Nvidia GB200 racks, built to train Grok.'},
    {at:'southaven_gas', path:['colossus2','southaven_gas'], text:'Its power comes from across the state line, at a former Duke Energy site in Southaven, Mississippi. Mobile turbines run there while a permanent 1.2 GW, 41-turbine plant goes up. The air permit was upheld in November 2026; an NAACP Clean Air Act suit continues.'},
    {at:'solaris', path:['southaven_gas','solaris'], text:'The turbines are rented. About 400 MW come from Solaris Energy of Houston, and xAI holds about two-thirds of its orderbook, per SemiAnalysis.'},
    {at:'hyperion_gas', path:['meta','hyperion','hyperion_gas'], text:'Meta went bigger. Its Hyperion campus in Louisiana is to be fed by 10 gas plants, ~7.5 GW in all, built by Entergy and paid for by Meta.'},
    {at:'onepwr', path:['anthropic','onepwr'], text:'Anthropic bought in directly: $3.4B for OnePWR’s 1.7 GW of gas generators, according to the FT.'},
    {at:'caterpillar', path:['nscale_wv','monarch_gas','caterpillar'], text:'Caterpillar turns up twice. It took over OnePWR’s commitments, and its G3500 gas gensets are planned for Nscale’s Monarch campus in West Virginia, capacity reported for Anthropic.'}
  ],
  close:'Rented turbines, generators bought outright, power plants paid for by the lab itself: on this map, the quickest power for AI comes from gas.'
}
];
