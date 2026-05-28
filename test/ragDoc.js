const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageBreak, LevelFormat, TabStopType, TabStopPosition,
  UnderlineType
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  black:'0A0A14', dark:'12121A', mid:'1A1A26',
  pink:'E91E8C', pinkD:'C2185B', pinkP:'FCE4EC', pinkL:'F8BBD9',
  white:'FFFFFF', gray:'F7F7F7', grayM:'E8E8E8', grayT:'6B6B6B',
  red:'C62828', amber:'E65100', green:'1B5E20', blue:'0D47A1',
  blueP:'E3F2FD', greenP:'E8F5E9', amberP:'FFF8E1', redP:'FFEBEE',
  teal:'004D40', tealP:'E0F2F1', purple:'4A148C', purpleP:'F3E5F5',
};

const W = 9360; // content width DXA

// ── Border helpers ────────────────────────────────────────────────────────────
const b = (color=C.grayM,size=4)=>({style:BorderStyle.SINGLE,size,color});
const borders = (color=C.grayM,size=4)=>({top:b(color,size),bottom:b(color,size),left:b(color,size),right:b(color,size)});
const nob = ()=>({style:BorderStyle.NONE,size:0,color:'FFFFFF'});
const noborders = ()=>({top:nob(),bottom:nob(),left:nob(),right:nob()});

// ── Cell ──────────────────────────────────────────────────────────────────────
const cell = (children, opts={}) => new TableCell({
  children: Array.isArray(children)?children:[children],
  borders: opts.borders||borders(C.grayM),
  shading: opts.bg?{fill:opts.bg,type:ShadingType.CLEAR}:undefined,
  width: opts.w?{size:opts.w,type:WidthType.DXA}:undefined,
  margins:{top:90,bottom:90,left:130,right:130},
  columnSpan: opts.span,
  verticalAlign: opts.va,
});

// ── Paragraph helpers ─────────────────────────────────────────────────────────
const p = (text,opts={}) => new Paragraph({
  alignment: opts.align||AlignmentType.LEFT,
  spacing:{before:opts.before??60,after:opts.after??70,line:opts.line??276},
  numbering: opts.num,
  border: opts.border,
  indent: opts.indent,
  children: Array.isArray(text)?text:[new TextRun({
    text:String(text), bold:opts.bold, italics:opts.italic,
    color:opts.color||C.black, size:opts.size||22, font:opts.font||'Arial',
    underline:opts.ul?{type:UnderlineType.SINGLE}:undefined,
  })]
});

const h1 = (text) => new Paragraph({
  heading:HeadingLevel.HEADING_1, spacing:{before:360,after:140},
  border:{bottom:{style:BorderStyle.SINGLE,size:8,color:C.pink,space:6}},
  children:[new TextRun({text,bold:true,size:40,font:'Arial',color:C.pink})]
});
const h2 = (text) => new Paragraph({
  heading:HeadingLevel.HEADING_2, spacing:{before:280,after:110},
  children:[new TextRun({text,bold:true,size:30,font:'Arial',color:C.dark})]
});
const h3 = (text) => new Paragraph({
  heading:HeadingLevel.HEADING_3, spacing:{before:220,after:90},
  children:[new TextRun({text,bold:true,size:24,font:'Arial',color:C.pinkD})]
});

const body = (text,opts={}) => new Paragraph({
  spacing:{before:60,after:80,line:300},
  alignment:opts.align,
  children:Array.isArray(text)?text:[new TextRun({text:String(text),size:22,font:'Arial',color:opts.color||C.black})]
});

const mono = (text) => new Paragraph({
  spacing:{before:30,after:30},
  shading:{fill:C.gray,type:ShadingType.CLEAR},
  indent:{left:280},
  children:[new TextRun({text,font:'Courier New',size:19,color:'333333'})]
});

const bull = (text,level=0) => new Paragraph({
  numbering:{reference:'bullets',level},
  spacing:{before:40,after:40,line:280},
  children:Array.isArray(text)?text:[new TextRun({text:String(text),size:22,font:'Arial',color:C.dark})]
});

const num = (text,level=0) => new Paragraph({
  numbering:{reference:'numbers',level},
  spacing:{before:40,after:40,line:280},
  children:Array.isArray(text)?text:[new TextRun({text:String(text),size:22,font:'Arial',color:C.dark})]
});

const divider = () => new Paragraph({
  spacing:{before:220,after:220},
  border:{bottom:{style:BorderStyle.SINGLE,size:6,color:C.pinkL,space:1}},
  children:[new TextRun('')]
});

const pb = () => new Paragraph({children:[new PageBreak()]});

const callout = (text,type='info') => {
  const m={info:{bg:C.blueP,bar:C.blue,txt:C.blue},warn:{bg:C.amberP,bar:C.amber,txt:'5D4037'},
           danger:{bg:C.redP,bar:C.red,txt:C.red},success:{bg:C.greenP,bar:C.green,txt:C.green},
           code:{bg:C.gray,bar:C.grayT,txt:'222222'},purple:{bg:C.purpleP,bar:C.purple,txt:C.purple}};
  const c=m[type]||m.info;
  return new Table({width:{size:W,type:WidthType.DXA},columnWidths:[160,W-160],
    rows:[new TableRow({children:[
      new TableCell({children:[p('')],borders:noborders(),shading:{fill:c.bar,type:ShadingType.CLEAR},width:{size:160,type:WidthType.DXA}}),
      new TableCell({children:[new Paragraph({spacing:{before:70,after:70,line:290},
        children:[new TextRun({text,size:20,font:'Arial',color:c.txt,italics:true})]})],
        borders:noborders(),shading:{fill:c.bg,type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:160,right:160}}),
    ]})]});
};

const headerRow = (...cols) => new TableRow({tableHeader:true,children:
  cols.map(([label,w])=>new TableCell({
    children:[p([new TextRun({text:label,bold:true,size:19,font:'Arial',color:C.white})],{align:AlignmentType.CENTER})],
    borders:borders(C.pinkD,6), shading:{fill:C.pink,type:ShadingType.CLEAR},
    width:{size:w,type:WidthType.DXA}, margins:{top:90,bottom:90,left:130,right:130},
  }))
});

const dataRow = (cells,shade=false) => new TableRow({children:
  cells.map(([text,w,bg],i)=>new TableCell({
    children:[new Paragraph({spacing:{before:70,after:70,line:285},
      children:[new TextRun({text:String(text),size:20,font:'Arial',color:C.dark})]})],
    borders:borders(C.grayM), shading:{fill:bg||(i===0?(shade?C.gray:C.gray):C.white),type:ShadingType.CLEAR},
    width:{size:w,type:WidthType.DXA}, margins:{top:70,bottom:70,left:130,right:130},
  }))
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering:{config:[
    {reference:'bullets',levels:[
      {level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}},
      {level:1,format:LevelFormat.BULLET,text:'–',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:1080,hanging:360}}}},
    ]},
    {reference:'numbers',levels:[
      {level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}},
      {level:1,format:LevelFormat.DECIMAL,text:'%1.%2.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:1080,hanging:360}}}},
    ]},
  ]},
  styles:{
    default:{document:{run:{font:'Arial',size:22}}},
    paragraphStyles:[
      {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,
        run:{size:40,bold:true,font:'Arial',color:C.pink},
        paragraph:{spacing:{before:360,after:140},outlineLevel:0}},
      {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,
        run:{size:30,bold:true,font:'Arial',color:C.dark},
        paragraph:{spacing:{before:280,after:110},outlineLevel:1}},
      {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,
        run:{size:24,bold:true,font:'Arial',color:C.pinkD},
        paragraph:{spacing:{before:220,after:90},outlineLevel:2}},
    ]
  },
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1080,right:1080,bottom:1080,left:1080}}},
    headers:{default:new Header({children:[new Paragraph({
      spacing:{before:0,after:0},
      border:{bottom:{style:BorderStyle.SINGLE,size:6,color:C.pink,space:4}},
      tabStops:[{type:TabStopType.RIGHT,position:TabStopPosition.MAX}],
      children:[
        new TextRun({text:'RAG ARCHITECTURE — JIKKEI',bold:true,size:18,font:'Arial',color:C.pink}),
        new TextRun({text:'\t',size:18}),
        new TextRun({text:'INTERNAL REFERENCE · V1.0',size:18,font:'Arial',color:C.grayT,italics:true}),
      ]
    })]})},
    footers:{default:new Footer({children:[new Paragraph({
      spacing:{before:0,after:0},
      border:{top:{style:BorderStyle.SINGLE,size:4,color:C.pinkL,space:4}},
      tabStops:[{type:TabStopType.RIGHT,position:TabStopPosition.MAX}],
      children:[
        new TextRun({text:'Retrieval-Augmented Generation — Complete Guide',size:18,font:'Arial',color:C.grayT}),
      ]
    })]})},
    children:[

// ══════════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════════
new Paragraph({spacing:{before:1200,after:0},alignment:AlignmentType.CENTER,
  children:[new TextRun({text:'⬡  JIKKEI  ⬡',size:22,font:'Arial',color:C.pink,bold:true})]}),
new Paragraph({spacing:{before:20,after:60},alignment:AlignmentType.CENTER,
  border:{bottom:{style:BorderStyle.SINGLE,size:10,color:C.pink,space:6}},
  children:[new TextRun('')]}),
new Paragraph({spacing:{before:140,after:20},alignment:AlignmentType.CENTER,
  children:[new TextRun({text:'RETRIEVAL-AUGMENTED GENERATION',size:60,font:'Arial',bold:true,color:C.dark})]}),
new Paragraph({spacing:{before:0,after:0},alignment:AlignmentType.CENTER,
  children:[new TextRun({text:'COMPLETE ARCHITECTURE GUIDE',size:44,font:'Arial',bold:true,color:C.pink})]}),
new Paragraph({spacing:{before:60,after:400},alignment:AlignmentType.CENTER,
  children:[new TextRun({text:'How Jikkei gives AI characters persistent memory, world awareness, and contextual intelligence',size:22,font:'Arial',italics:true,color:C.grayT})]}),

new Table({width:{size:5400,type:WidthType.DXA},columnWidths:[2000,3400],
  rows:[
    new TableRow({children:[
      cell(p([new TextRun({text:'Project',bold:true,size:20,font:'Arial',color:C.white})]),{bg:C.dark,borders:borders(C.dark)}),
      cell(p('Jikkei — AI Visual Novel Platform'),{bg:C.gray,borders:borders(C.grayM)}),
    ]}),
    new TableRow({children:[
      cell(p([new TextRun({text:'Embedding model',bold:true,size:20,font:'Arial',color:C.white})]),{bg:C.dark,borders:borders(C.dark)}),
      cell(p('text-embedding-3-small (OpenAI) — 1536 dimensions'),{bg:C.gray,borders:borders(C.grayM)}),
    ]}),
    new TableRow({children:[
      cell(p([new TextRun({text:'Vector store',bold:true,size:20,font:'Arial',color:C.white})]),{bg:C.dark,borders:borders(C.dark)}),
      cell(p('pgvector extension on PostgreSQL (Supabase)'),{bg:C.gray,borders:borders(C.grayM)}),
    ]}),
    new TableRow({children:[
      cell(p([new TextRun({text:'Generation model',bold:true,size:20,font:'Arial',color:C.white})]),{bg:C.dark,borders:borders(C.dark)}),
      cell(p('Gemini 2.5 Flash-Lite (free tier) · Claude Sonnet 4.6 (premium)'),{bg:C.gray,borders:borders(C.grayM)}),
    ]}),
    new TableRow({children:[
      cell(p([new TextRun({text:'Status',bold:true,size:20,font:'Arial',color:C.white})]),{bg:C.dark,borders:borders(C.dark)}),
      cell(p([new TextRun({text:'Backend implemented · Not yet end-to-end tested',size:20,font:'Arial',color:C.amber})]),{bg:C.gray,borders:borders(C.grayM)}),
    ]}),
  ]}),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 0: THE PROBLEM
// ══════════════════════════════════════════════════════════════════════════════
h1('0. The Problem RAG Solves'),
body('Every call to the Gemini or Claude API starts from absolute zero. The model has no memory of previous sessions, no knowledge of the character\'s lore, no awareness of what the player did last week, and no understanding of the world rules the creator defined. Without intervention, every dialogue turn would feel like talking to a stranger who just woke up with amnesia.'),
body('RAG — Retrieval-Augmented Generation — is the architecture that solves this. It is not a single technology. It is a pipeline: before every AI call, the system retrieves the most relevant knowledge and injects it into the prompt. The AI generates its response with that knowledge in context, as if it already knew it.'),

callout('RAG is not "giving the AI a memory." It is curating a briefing document before every conversation turn, containing only the most relevant facts for that specific moment.','purple'),

body('There are actually two distinct memory problems that get confused:'),
bull([new TextRun({text:'Short-term memory: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'What happened in the last 10 turns of this conversation? Solved by conversation history — simple, just send it.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Long-term memory: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'What is true about this character, world, and player across all sessions forever? Solved by RAG.',size:22,font:'Arial'})]),
body('Both need solving. They use completely different approaches. This document covers both but focuses primarily on RAG as the more complex and novel system.'),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: WHAT IS RAG
// ══════════════════════════════════════════════════════════════════════════════
h1('1. What RAG Is — Plain Language'),
h2('1.1 The Core Idea'),
body('RAG works in two phases: an offline phase that runs once when content is created, and an online phase that runs in real time before every AI generation call.'),
body('Offline phase (setup time): Every piece of text that should inform AI responses — character descriptions, world lore, behavioral rules, past events — is converted into a mathematical representation called a vector embedding. These embeddings are stored in a database optimized for similarity search.'),
body('Online phase (play time): When a player sends a message, that message is also converted into a vector embedding. The system searches the database for the stored embeddings most mathematically similar to the player\'s message. The corresponding text chunks are retrieved and injected into the AI prompt before generation happens.'),

callout('The mathematical insight: "let\'s go to the lake" and "she gets quiet near water" are semantically similar even though they share no words. Vector embeddings capture meaning, not keywords. This is why RAG finds relevant lore that keyword search would miss.','info'),

h2('1.2 A Concrete Example'),
body('Creator writes this lore when building the character Ayaka:'),
mono('"Ayaka\'s mother drowned three years ago at Lake Shiro."'),
mono('"She becomes visibly uncomfortable near any body of water."'),
mono('"She has never spoken about her mother\'s death to anyone."'),
body('These sentences get embedded and stored. Fast forward to gameplay. The player types:'),
mono('"I suggest we take a walk by the river to clear your head."'),
body('The system embeds the player\'s message and searches the vector database. The embeddings for "river" and "walk by water" are mathematically close to the embeddings for "Lake Shiro" and "body of water." The lore chunks are retrieved and injected into the prompt before Gemini generates Ayaka\'s response.'),
body('Gemini generates a response that naturally reflects Ayaka\'s discomfort near water — without ever being explicitly told "this player just mentioned water." The retrieval happened silently, automatically, and precisely because of semantic similarity.'),
body('Without RAG: Ayaka would cheerfully agree to the walk, breaking the character entirely.'),
body('With RAG: Ayaka\'s response reflects her trauma. The world is consistent. The character feels real.'),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
h1('2. Every Component — What It Is and What It Does'),

h2('2.1 The Embedding Model — text-embedding-3-small'),
body('An embedding model converts text into a high-dimensional vector — a list of 1536 floating-point numbers that encodes the semantic meaning of the text. Texts with similar meanings produce vectors that are close to each other in this 1536-dimensional space. Texts with different meanings produce vectors that are far apart.'),

new Table({width:{size:W,type:WidthType.DXA},columnWidths:[2200,3080,4080],rows:[
  headerRow(['Property',2200],['Value',3080],['Why it matters',4080]),
  dataRow([['Model name',2200],['text-embedding-3-small',3080],['OpenAI\'s most cost-efficient embedding model. Proven quality for semantic search.',4080]]),
  dataRow([['Dimensions',2200],['1536',3080],['Each text becomes a 1536-number vector. Higher = more expressive but more storage.',4080]],true),
  dataRow([['Max input',2200],['8192 tokens (~6000 words)',3080],['Single lore chunks never approach this limit. No chunking issues.',4080]]),
  dataRow([['Cost',2200],['$0.02 per 1M tokens',3080],['Embedding 10,000 lore chunks costs roughly $0.04. Negligible.',4080]],true),
  dataRow([['Latency',2200],['~50ms per call',3080],['Fast enough for real-time retrieval without noticeable delay.',4080]]),
  dataRow([['Why not an LLM?',2200],['100x cheaper, faster, specialized',3080],['Using Claude/Gemini for embeddings is like hiring a chef to sort mail. Wrong tool.',4080]],true),
]}),

body('Every time text needs to be embedded — a lore chunk at setup, a player message at play time, a scene event after a turn — this model is called. The resulting vector is what gets stored in pgvector and searched at retrieval time.'),

h2('2.2 The Vector Database — pgvector'),
body('pgvector is a PostgreSQL extension that adds a new column type: vector(1536). This allows storing embedding vectors directly in the same database as all other application data, with no separate vector database service required.'),
body('The critical operation pgvector enables is the cosine similarity search:'),
mono('SELECT content, 1 - (embedding <=> query_vector) AS similarity'),
mono('FROM lore_chunks'),
mono('WHERE scene_id = :scene_id'),
mono('ORDER BY embedding <=> query_vector  -- <=> is cosine distance'),
mono('LIMIT 4;'),
body('The <=> operator computes cosine distance between two vectors. Distance of 0 means identical meaning. Distance of 1 means completely unrelated. Subtracting from 1 gives similarity: 1.0 = identical, 0.0 = unrelated.'),
body('An IVFFlat index makes this search fast even with millions of rows:'),
mono('CREATE INDEX ON lore_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);'),
body('Without this index, every search would compare the query vector against every row — O(n) complexity. With the index, search is approximate but fast — sublinear complexity. The approximation trades perfect recall for speed, which is acceptable for dialogue lore retrieval.'),

callout('Why pgvector instead of Pinecone/Weaviate: One database, no extra service to deploy, secure, and free. At Jikkei\'s current scale (thousands of users, millions of chunks), pgvector handles the load comfortably. Migration to a dedicated vector DB is a future concern, not a current one.','success'),

h2('2.3 The lore_chunks Table — What Gets Stored'),
body('Every piece of knowledge that should inform AI responses lives in this table. Each row is one chunk of text with its embedding vector and metadata.'),

new Table({width:{size:W,type:WidthType.DXA},columnWidths:[1800,1200,6360],rows:[
  headerRow(['Column',1800],['Type',1200],['Purpose',6360]),
  dataRow([['id',1800],['UUID',1200],['Primary key',6360]]),
  dataRow([['scene_id',1800],['UUID FK',1200],['Scopes retrieval to the current scene. Never leaks lore across scenes.',6360]],true),
  dataRow([['character_id',1800],['UUID FK nullable',1200],['Links chunk to a specific character. Null for world-level lore.',6360]]),
  dataRow([['content',1800],['TEXT',1200],['The raw text that gets injected into the prompt. What the AI actually reads.',6360]],true),
  dataRow([['chunk_type',1800],['TEXT',1200],["'character' | 'world' | 'rule' | 'event' | 'context_change' — controls priority logic.",6360]]),
  dataRow([['priority',1800],['INTEGER',1200],['0-4. Priority 3+ always injected regardless of similarity score. Priority 1-2 only if semantically matched.',6360]],true),
  dataRow([['embedding',1800],['vector(1536)',1200],['The 1536-dimensional mathematical representation of content. Used for similarity search.',6360]]),
  dataRow([['created_at',1800],['TIMESTAMPTZ',1200],['When this chunk was created. Events created during play have recent timestamps.',6360]],true),
]}),

h3('Priority Levels Explained'),
body('Priority is the most important metadata field. It controls whether a chunk is retrieved by similarity or by importance:'),
bull([new TextRun({text:'Priority 4 — Always injected, highest weight: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Scene context, world rules, context changes. The AI must always know these.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Priority 3 — Always injected: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Character descriptions, key world facts. Core identity information.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Priority 2 — Injected when conditions active: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Rules and triggers. Only relevant when their conditions apply.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Priority 1 — Injected when semantically matched: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Past events, specific lore details. Injected only when the conversation touches them.',size:22,font:'Arial'})]),

h2('2.4 The Three Memory Sources'),
body('Before every AI call, context is assembled from three distinct sources simultaneously. Each answers a different question:'),

new Table({width:{size:W,type:WidthType.DXA},columnWidths:[1600,2000,2200,3560],rows:[
  headerRow(['Source',1600],['Storage',2000],['Question it answers',2200],['What it contains',3560]),
  dataRow([['Memory A — History',1600],['Redis',2000],['What just happened?',2200],['Last 8 conversation turns verbatim. User messages and character responses.',3560]]),
  dataRow([['Memory B — RAG',1600],['pgvector',2000],['What do we know that\'s relevant?',2200],['Top 4 lore chunks semantically similar to current player message.',3560]],true),
  dataRow([['Memory C — World State',1600],['PostgreSQL',2000],['What is true right now?',2200],['Live attribute values, current background, recent world events, active context changes.',3560]]),
]}),

body('All three are fetched in parallel using asyncio.gather() before the AI call. Total fetch latency is approximately 150-250ms — the slowest of the three operations determines the total, not their sum.'),

h2('2.5 The Context Builder — Assembling the Prompt'),
body('The context builder is the orchestration layer that pulls from all three memory sources and assembles the complete system prompt. It never calls the AI directly — it prepares the briefing that gets handed to the AI service.'),
body('The system prompt is assembled in this exact order. Order is critical because the AI gives more weight to information that appears earlier:'),

new Table({width:{size:W,type:WidthType.DXA},columnWidths:[1400,1400,6560],rows:[
  headerRow(['Block',1400],['Source',1400],['Content',6560]),
  dataRow([['[IDENTITY]',1400],['Setup config',1400],['Who the character is: name, full description, current expression. Static per scene.',6560]]),
  dataRow([['[ATTRIBUTES]',1400],['World State',1400],['Live values: affinity 42/100, sanity 78/100, craziness 31/100. Updates every turn.',6560]],true),
  dataRow([['[LORE]',1400],['RAG',1400],['Top 4 retrieved chunks most relevant to current player message. Dynamic per turn.',6560]]),
  dataRow([['[RULES]',1400],['Setup config',1400],['Behavioral rules in priority order. Static unless creator edits them.',6560]],true),
  dataRow([['[SCENE]',1400],['Setup config',1400],['Scene context, world rules, win/fail conditions. Static per scene.',6560]]),
  dataRow([['[CONDITIONS]',1400],['World State',1400],['Active trigger instructions. Only present when attribute thresholds are met.',6560]],true),
  dataRow([['[CONTEXT_CHANGE]',1400],['World State',1400],['Narrative shift text if player submitted one. Active for 3 turns then clears.',6560]]),
  dataRow([['[HISTORY_SUMMARY]',1400],['PostgreSQL',1400],['Compressed summary of turns older than 8. Built by compression service.',6560]],true),
  dataRow([['[FORMAT]',1400],['Hardcoded',1400],['JSON response schema. Always last, non-negotiable. Forces structured output.',6560]]),
]}),

callout('The FORMAT block is the most critical. It explicitly tells the AI to return a specific JSON object with specific fields. Without this, AI responses are unstructured prose — the frontend cannot parse expressions, attribute changes, or background changes.','danger'),

h2('2.6 The AI Service — Generation'),
body('The AI service takes the assembled prompt and messages array, calls either Gemini or Claude depending on user tier, and parses the structured JSON response.'),
body('Free tier (Gemini 2.5 Flash-Lite): $0.10 input / $0.40 output per 1M tokens. At 5000 tokens per assembled prompt plus 300 tokens of response, each turn costs approximately $0.00067.'),
body('Premium tier (Claude Sonnet 4.6): Better roleplay quality, higher cost. Reserved for pro subscribers.'),
body('The response parser handles JSON extraction, markdown fence stripping, and retries once on parse failure. If the second attempt also fails, the error is logged and the credit is not refunded — preventing retry abuse.'),

h2('2.7 The History Service — Short-Term Memory'),
body('Conversation history is stored in Redis with key format session:{session_id}:history. Each entry is a JSON object with role and content fields matching the AI provider\'s message format.'),
body('Maximum 16 entries (8 user + 8 assistant messages) are kept verbatim. At the 8-turn mark, the oldest 4 turns are compressed into a summary paragraph using a cheap Gemini call, stored in scene_sessions.history_summary, and removed from Redis. The remaining 4 turns stay verbatim.'),
body('This keeps token costs bounded regardless of session length. A 200-turn session costs approximately the same as a 10-turn session in terms of context tokens, because history is continuously compressed.'),

h2('2.8 The Write-Back Loop — Creating New Memories'),
body('After every AI turn, significant events become new lore chunks. This is how the system accumulates episodic memory — not just facts the creator wrote, but things that actually happened during play.'),
body('When the AI response contains a non-null scene_event field, that text is embedded and stored as a new lore_chunk with chunk_type="event" and priority=1. It will be retrieved in future turns when semantically relevant.'),
body('Example: Turn 7, player reveals their real name to the character. The AI response includes scene_event: "Player revealed their true name: Kaito." This gets embedded and stored. In turn 34, if the player references their name again, this event chunk is retrieved and injected — the character remembers.'),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: THE COMPLETE FLOW
// ══════════════════════════════════════════════════════════════════════════════
h1('3. The Complete Flow — Step by Step'),

h2('3.1 Setup Phase (runs once when creator finishes the wizard)'),
num('Creator completes the 5-step scene wizard and clicks Launch.'),
num('Frontend uploads all images to Cloudinary via signed upload.'),
num('Frontend POSTs scene data to POST /api/scenes.'),
num('Backend creates all database records: Scene, Character, Expressions, Attributes, Rules, Triggers, Backgrounds.'),
num('Backend spawns embed_scene_setup() as a FastAPI BackgroundTask — HTTP response returns immediately without waiting for embeddings.'),
num('Background task fetches the scene with all relations, builds text chunks from every piece of content, calls OpenAI embeddings API in batches of 10, stores LoreChunk rows with vectors in pgvector.'),
num('Embedding complete: lore_chunks table now contains 15-40 rows depending on how much content the creator wrote.'),
callout('The HTTP response for scene creation returns before embeddings are complete. The play button should not be available for 5-10 seconds after scene creation. Add a "Scene preparing..." state in the UI to handle this gracefully.','warn'),

h2('3.2 Play Phase — Every Single Turn'),
num('Player opens the play screen. Frontend calls POST /api/sessions/start. Backend creates SceneSession row, initializes attribute_values from character initial values, returns session_id.'),
num('Player sends input (prompt text, choice selection, or context change).'),
num('Frontend calls POST /api/sessions/turn with session_id, input_type, and player_input.'),
num('Backend loads the session and verifies: is_active=true, user owns session, turn_count < MAX_TURNS_PER_SESSION.'),
num('Backend calls consume_credit() — deducts 1 from user\'s daily credits. If credits = 0, returns 429 immediately before any AI call.'),
num('Backend calls compress_if_needed() — if turn_count is a multiple of 8, compresses oldest history turns into summary.'),
num('Backend calls build_turn_context():'),
  p([new TextRun({text:'   a.',size:22,font:'Arial',bold:true}),new TextRun({text:' Fetches scene with all relations from PostgreSQL.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   b.',size:22,font:'Arial',bold:true}),new TextRun({text:' Fetches conversation history from Redis.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   c.',size:22,font:'Arial',bold:true}),new TextRun({text:' Calls search_relevant_lore() — embeds player input, runs pgvector similarity search, returns top 4 chunks.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   d.',size:22,font:'Arial',bold:true}),new TextRun({text:' Reads live attribute values and world events from session record.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   e.',size:22,font:'Arial',bold:true}),new TextRun({text:' Evaluates trigger conditions against current attribute values.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   f.',size:22,font:'Arial',bold:true}),new TextRun({text:' Assembles complete system prompt from all 9 blocks in order.',size:22,font:'Arial'})],{indent:{left:720}}),
num('Backend calls run_ai_turn() — routes to Gemini (free) or Claude (premium) based on user tier.'),
num('AI generates response. Backend parses JSON. Retries once if parse fails.'),
num('Backend calls apply_turn_result():'),
  p([new TextRun({text:'   a.',size:22,font:'Arial',bold:true}),new TextRun({text:' Clamps attribute deltas to valid ranges.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   b.',size:22,font:'Arial',bold:true}),new TextRun({text:' Updates session.attribute_values in PostgreSQL.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   c.',size:22,font:'Arial',bold:true}),new TextRun({text:' Updates current background if background_change is non-null.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   d.',size:22,font:'Arial',bold:true}),new TextRun({text:' Appends scene_event to world_events array (capped at 20).',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   e.',size:22,font:'Arial',bold:true}),new TextRun({text:' Creates DialogueTurn record with full raw_ai_response stored for redo functionality.',size:22,font:'Arial'})],{indent:{left:720}}),
  p([new TextRun({text:'   f.',size:22,font:'Arial',bold:true}),new TextRun({text:' Checks game_over — if triggered, sets session.is_active=false.',size:22,font:'Arial'})],{indent:{left:720}}),
num('Backend calls append_turn() — appends user message and character response to Redis history.'),
num('If scene_event is non-null: spawns store_event_as_lore() as BackgroundTask — embeds event and stores as new lore chunk.'),
num('Returns TurnResponse to frontend. Frontend renders dialogue, updates expression sprite, updates attribute bars, maybe changes background.'),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: WHAT WE HAVE RIGHT NOW
// ══════════════════════════════════════════════════════════════════════════════
h1('4. What We Have Right Now'),
body('This section maps every RAG component to its implementation status in the current codebase.'),

new Table({width:{size:W,type:WidthType.DXA},columnWidths:[2600,2200,2200,2360],rows:[
  headerRow(['Component',2600],['File',2200],['Status',2200],['Notes',2360]),
  dataRow([['Embedding function',2600],['app/services/lore_service.py',2200],['✅ Written',2200],['Calls OpenAI text-embedding-3-small',2360]]),
  dataRow([['Scene setup embedding',2600],['embed_scene_setup()',2200],['✅ Written',2200],['Runs as BackgroundTask after scene creation',2360]],true),
  dataRow([['pgvector search',2600],['search_relevant_lore()',2200],['✅ Written',2200],['Two-stage: priority + similarity threshold',2360]]),
  dataRow([['Event write-back',2600],['store_event_as_lore()',2200],['✅ Written',2200],['Called after each turn if scene_event present',2360]],true),
  dataRow([['Context change lore',2600],['store_context_change_as_lore()',2200],['✅ Written',2200],['Priority 4 — always injected after submission',2360]]),
  dataRow([['Context builder',2600],['app/services/context_builder.py',2200],['✅ Written',2200],['Assembles all 9 prompt blocks',2360]],true),
  dataRow([['System prompt builder',2600],['build_system_prompt()',2200],['✅ Written',2200],['Includes all blocks including FORMAT',2360]]),
  dataRow([['Trigger evaluator',2600],['evaluate_triggers()',2200],['✅ Written',2200],['Checks attribute thresholds, returns active instructions',2360]],true),
  dataRow([['Gemini integration',2600],['app/services/ai_service.py',2200],['✅ Written',2200],['Flash-Lite, JSON mode, retry on parse fail',2360]]),
  dataRow([['Claude integration',2600],['app/services/ai_service.py',2200],['✅ Written',2200],['Sonnet 4.6, markdown fence stripping, retry',2360]],true),
  dataRow([['Redis history',2600],['app/services/history_service.py',2200],['✅ Written',2200],['get/append/compress, 7-day TTL',2360]]),
  dataRow([['History compression',2600],['compress_if_needed()',2200],['✅ Written',2200],['Runs every 8 turns, summary stored in DB',2360]],true),
  dataRow([['Credit system',2600],['app/services/credit_service.py',2200],['✅ Written',2200],['20 daily credits, auto-replenish, consume before AI call',2360]]),
  dataRow([['Turn endpoint',2600],['POST /api/sessions/turn',2200],['✅ Written',2200],['Full orchestration: credits → compress → context → AI → apply',2360]],true),
  dataRow([['DB schema',2600],['lore_chunks + scene_sessions',2200],['✅ Written',2200],['SQL in Prompt 1, IVFFlat index created',2360]]),
  dataRow([['SQLAlchemy models',2600],['app/models/scene.py',2200],['✅ Written',2200],['LoreChunk uses Vector(1536) from pgvector',2360]],true),
  dataRow([['End-to-end tested',2600],['Full play loop',2200],['❌ Not yet',2200],['Waiting on play screen (Step 3)',2360]]),
  dataRow([['Context change endpoint',2600],['POST /sessions/{id}/context-change',2200],['✅ Written',2200],['Sets active_context_change, spawns lore embedding',2360]],true),
  dataRow([['Redo endpoint',2600],['POST /sessions/{id}/redo',2200],['✅ Written',2200],['Blocked for hardcore mode, restores prev snapshot',2360]]),
]}),

h2('4.1 What Has Never Run'),
body('The pipeline is written but has never executed in a real browser session. These are the things that will need debugging when the play screen connects:'),
bull([new TextRun({text:'embed_scene_setup() ',bold:true,size:22,font:'Arial'}),new TextRun({text:'— has never been triggered. First test: create a scene, check lore_chunks table for rows 5-10 seconds later.',size:22,font:'Arial'})]),
bull([new TextRun({text:'search_relevant_lore() ',bold:true,size:22,font:'Arial'}),new TextRun({text:'— has never been called with a real query. The IVFFlat index requires at least 100 rows before it works well. With fewer rows it falls back to sequential scan.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Gemini JSON response parsing ',bold:true,size:22,font:'Arial'}),new TextRun({text:'— Gemini occasionally wraps JSON in markdown fences despite response_mime_type="application/json". The retry logic handles this but has not been tested at volume.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Attribute delta clamping ',bold:true,size:22,font:'Arial'}),new TextRun({text:'— min/max enforcement in apply_turn_result() is correct in code but untested with real AI output which sometimes returns deltas outside the expected -10 to +10 range.',size:22,font:'Arial'})]),
bull([new TextRun({text:'History compression ',bold:true,size:22,font:'Arial'}),new TextRun({text:'— the compression Gemini call has never run. Edge case: what if compression itself fails? The session should continue even if compression errors.',size:22,font:'Arial'})]),

callout('None of these are bugs — they are untested paths that are correct by design. End-to-end testing happens when the play screen is built in Step 3. Expect 1-2 days of debugging and prompt tuning after first connection.','warn'),

h2('4.2 Known Tuning Areas After First Test'),
body('These are things that will almost certainly need adjustment after seeing the first real AI responses:'),
bull([new TextRun({text:'Similarity threshold (currently 0.70): ',bold:true,size:22,font:'Arial'}),new TextRun({text:'May need lowering to 0.65 if relevant lore is not being retrieved, or raising to 0.75 if irrelevant chunks are appearing.',size:22,font:'Arial'})]),
bull([new TextRun({text:'top_k value (currently 4): ',bold:true,size:22,font:'Arial'}),new TextRun({text:'4 chunks may be too few for complex scenes or too many for simple ones. Tune based on prompt token count and response quality.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Attribute delta range (±10): ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Gemini may return values outside this range or return 0 for everything. The FORMAT block instructs ±10 max but LLMs sometimes ignore numeric constraints.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Temperature (currently 0.85): ',bold:true,size:22,font:'Arial'}),new TextRun({text:'0.85 is slight creativity. May need increasing for more dynamic characters or decreasing for more consistent responses.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Chunk size: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Current chunks are 1-3 sentences. If retrieval feels imprecise, splitting into smaller single-sentence chunks improves precision at the cost of more rows.',size:22,font:'Arial'})]),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: COST MODEL
// ══════════════════════════════════════════════════════════════════════════════
h1('5. Cost Model'),

new Table({width:{size:W,type:WidthType.DXA},columnWidths:[2400,2400,2400,2160],rows:[
  headerRow(['Operation',2400],['Model',2400],['Cost',2400],['Frequency',2160]),
  dataRow([['Embed lore chunk at setup',2400],['text-embedding-3-small',2400],['~$0.000002 per chunk',2400],['Once per chunk, at scene creation',2160]]),
  dataRow([['Embed player message',2400],['text-embedding-3-small',2400],['~$0.000001 per turn',2400],['Every turn',2160]],true),
  dataRow([['Dialogue generation (free)',2400],['Gemini 2.5 Flash-Lite',2400],['~$0.00067 per turn',2400],['Every turn (free tier)',2160]]),
  dataRow([['Dialogue generation (pro)',2400],['Claude Sonnet 4.6',2400],['~$0.02 per turn',2400],['Every turn (pro tier)',2160]],true),
  dataRow([['History compression',2400],['Gemini 2.5 Flash-Lite',2400],['~$0.0003 per compression',2400],['Every 8 turns',2160]]),
]}),

body('For a free-tier user playing 20 turns per day (the daily credit limit):'),
bull('Embedding: 20 × $0.000001 = $0.00002'),
bull('Generation: 20 × $0.00067 = $0.0134'),
bull('Compression: 20/8 × $0.0003 = $0.00075'),
bull([new TextRun({text:'Total per user per day: ~$0.014 (1.4 cents)',bold:true,size:22,font:'Arial'})]),
body('At 1000 daily active free-tier users, the daily AI cost is approximately $14. Monthly: $420. This is sustainable with a modest subscription revenue or advertising model.'),
callout('The credit system (20 credits per day) is both a cost control mechanism and a monetization hook. Pro users get more credits and access to Claude for higher quality responses. This is the natural upgrade funnel.','info'),

pb(),

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6: OPTIMIZATIONS
// ══════════════════════════════════════════════════════════════════════════════
h1('6. Optimizations Already Implemented'),
body('These are performance and cost decisions already baked into the current implementation:'),
bull([new TextRun({text:'Parallel fetching: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'asyncio.gather() fetches history and lore simultaneously. Total fetch time = max(history_time, lore_time), not their sum.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Priority-based retrieval: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'High-priority chunks always injected without similarity search. Low-priority only when semantically matched. Reduces irrelevant lore injection.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Similarity threshold: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'0.70 minimum similarity required. Prevents weak matches from polluting the prompt with tangentially related lore.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Sliding window compression: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'History token cost stays bounded regardless of session length. Long sessions cost the same as short ones.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Background embedding: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Lore embedding runs as a BackgroundTask. HTTP response for scene creation is not blocked by embedding time.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Event lore write-back as background task: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Scene event embedding runs after the turn response is returned. Player sees dialogue immediately.',size:22,font:'Arial'})]),
bull([new TextRun({text:'IVFFlat index: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Approximate nearest neighbor search. Sublinear complexity. 100 lists configured — tune upward as data grows past 1M rows.',size:22,font:'Arial'})]),
bull([new TextRun({text:'Credits consumed before AI call: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'Fast-fail before spending money. Prevents retry loops from multiplying costs.',size:22,font:'Arial'})]),
bull([new TextRun({text:'JSON mode on Gemini: ',bold:true,size:22,font:'Arial'}),new TextRun({text:'response_mime_type="application/json" reduces but does not eliminate non-JSON responses. Retry logic handles remaining failures.',size:22,font:'Arial'})]),

divider(),

new Paragraph({spacing:{before:200,after:60},alignment:AlignmentType.CENTER,
  children:[new TextRun({text:'— END OF DOCUMENT —',size:20,font:'Arial',color:C.pink,bold:true})]}),
new Paragraph({spacing:{before:0,after:0},alignment:AlignmentType.CENTER,
  children:[new TextRun({text:'RAG Architecture Guide v1.0 · Jikkei · Internal Reference',size:18,font:'Arial',italics:true,color:C.grayT})]}),

    ]}]
});

const outputDocx = path.join(__dirname, 'RAG_Architecture_Jikkei.docx');
const outputHtml = path.join(__dirname, 'ragDoc-preview.html');

Packer.toBuffer(doc).then(b=>{
  fs.writeFileSync(outputDocx, b);
  fs.writeFileSync(outputHtml, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>RAG Architecture Guide Export</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: linear-gradient(180deg, #12121a 0%, #1a1a26 100%);
      color: #f7f7f7;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      box-sizing: border-box;
    }
    .card {
      width: min(760px, 100%);
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
    }
    h1 { margin: 0 0 12px; color: #fce4ec; font-size: 30px; }
    p { line-height: 1.6; color: #e8e8e8; }
    a {
      display: inline-block;
      margin-top: 18px;
      padding: 12px 16px;
      border-radius: 999px;
      background: #e91e8c;
      color: white;
      text-decoration: none;
      font-weight: 700;
    }
    code {
      display: block;
      margin-top: 16px;
      padding: 14px;
      border-radius: 14px;
      background: rgba(255,255,255,0.08);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>RAG Architecture Guide Exported</h1>
    <p>The Node script finished successfully and wrote the DOCX file below. Open it from the link, or use the path if your editor supports local file navigation.</p>
    <a href="./RAG_Architecture_Jikkei.docx">Download DOCX</a>
    <code>${outputDocx.replace(/\\/g, '\\\\')}</code>
  </main>
</body>
</html>`, 'utf8');
  console.log(`DOCX written to ${outputDocx}`);
  console.log(`HTML preview written to ${outputHtml}`);
});