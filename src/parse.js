'use strict';
const { getSecrets } = require('../utils/secrets');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: 'us-east-1' });
const CACHE_BUCKET = 'freightiq-dimensions-cache';

async function getCachedDims(sku) {
  if (!sku) return null;
  try {
    var key = 'dims/' + sku.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    var res = await s3.send(new GetObjectCommand({ Bucket: CACHE_BUCKET, Key: key }));
    var body = await res.Body.transformToString();
    var data = JSON.parse(body);
    if (!data.dimensions || data.dimensions === 'N/A' || !data.weight || data.weight === 'N/A') {
      console.log('[cache] SKIP (invalid):', sku);
      return null;
    }
    console.log('[cache] HIT:', sku);
    return data;
  } catch (e) { return null; }
}

async function cacheDims(sku, data) {
  if (!sku || !data.dimensions || data.dimensions === 'N/A') return;
  try {
    var key = 'dims/' + sku.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    await s3.send(new PutObjectCommand({
      Bucket: CACHE_BUCKET, Key: key,
      Body: JSON.stringify(data), ContentType: 'application/json'
    }));
    console.log('[cache] SAVED:', sku);
  } catch (e) { console.error('[cache] FAILED:', sku, e.message); }
}

function estimateDimsAndWeight(name) {
  var n = (name || '').toLowerCase();
  if (n.includes('server') || n.includes('thinksystem') || n.includes('poweredge') || n.includes('proliant'))
    return { dimensions: '30 x 17.5 x 3.5 in', weight: 55 };
  if (n.includes('2.5') && (n.includes('hdd') || n.includes('hard drive') || n.includes('sas') || n.includes('ssd')))
    return { dimensions: '4 x 2.8 x 0.3 in', weight: 0.5 };
  if (n.includes('3.5') && (n.includes('hdd') || n.includes('hard drive')))
    return { dimensions: '5.8 x 4 x 1 in', weight: 1.5 };
  if (n.includes('dimm') || n.includes('ddr') || n.includes('memory') || n.includes('ram') || n.includes('rdimm'))
    return { dimensions: '5.3 x 1.2 x 0.15 in', weight: 0.1 };
  if (n.includes('monitor') || n.includes('display'))
    return { dimensions: '24 x 18 x 8 in', weight: 18 };
  if (n.includes('switch') || n.includes('router') || n.includes('firewall'))
    return { dimensions: '17.5 x 12 x 1.7 in', weight: 12 };
  if (n.includes('laptop') || n.includes('notebook') || n.includes('thinkpad'))
    return { dimensions: '14 x 10 x 3 in', weight: 6 };
  if (n.includes('ups') || n.includes('battery'))
    return { dimensions: '18 x 12 x 8 in', weight: 40 };
  if (n.includes('printer'))
    return { dimensions: '20 x 18 x 14 in', weight: 25 };
  if (n.includes('keyboard') || n.includes('mouse'))
    return { dimensions: '18 x 6 x 2 in', weight: 1 };
  if (n.includes('cable') || n.includes('adapter'))
    return { dimensions: '6 x 4 x 2 in', weight: 0.3 };
  return { dimensions: '12 x 10 x 6 in', weight: 5 };
}

var PARSE_PROMPT = 'You are an invoice parser for a freight cost calculator.\n' +
  'Extract every UNIQUE product line item. Do NOT expand quantities.\n' +
  'If "Qty: 6" or "6x", return ONE row with "qty": 6.\n\n' +
  'CLASSIFY each item:\n' +
  '- HARDWARE: any tangible IT equipment\n' +
  '- SOFTWARE: licenses, subscriptions, services, warranties\n\n' +
  'Do NOT include dimensions or weight.\n' +
  'Return ONLY a valid JSON array. No markdown, no code fences.\n' +
  '[{"name":"Product name","model":"SKU or null","type":"hardware or software","qty":1,"unitPrice":0.00}]';

var DIMS_PROMPT = 'Find exact shipping dimensions and weight for each product.\n' +
  'Search manufacturer websites using the SKU/part number.\n' +
  'Return dimensions as "L x W x H in" (inches), weight in lbs.\n' +
  'If only bare dimensions found, add 20% for packaging.\n' +
  'NEVER return "N/A" - always provide a number.\n' +
  'Return ONLY a valid JSON array. No markdown, no code fences.\n' +
  '[{"model":"SKU","dimensions":"L x W x H in","weight":number}]';

async function callGemini(apiKey, parts, systemPrompt, useSearch) {
  var body = {
    contents: [{ role: 'user', parts: parts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    var err = await res.text();
    throw new Error('Gemini ' + res.status + ': ' + err.slice(0, 200));
  }

  var data = await res.json();
  var textParts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return textParts.filter(function(p) { return p.text; }).map(function(p) { return p.text; }).join('');
}

async function callOpenAI(apiKey, userContent, systemPrompt, isImage, isPDF, base64, mediaType) {
  var messages = [{ role: 'system', content: systemPrompt }];

  if (isImage && base64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:' + mediaType + ';base64,' + base64 } },
        { type: 'text', text: userContent }
      ]
    });
  } else if (isPDF && base64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'file', file: { filename: 'invoice.pdf', file_data: 'data:application/pdf;base64,' + base64 } },
        { type: 'text', text: userContent }
      ]
    });
  } else {
    messages.push({ role: 'user', content: userContent });
  }

  var res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: 'gpt-4o', messages: messages, max_tokens: 4096, temperature: 0.1 })
  });

  if (!res.ok) {
    var err = await res.text();
    throw new Error('OpenAI ' + res.status + ': ' + err.slice(0, 200));
  }
  var data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

exports.handler = async function(input) {
  var content = input.content;
  var base64 = input.base64;
  var mediaType = input.mediaType;

  var secrets = await getSecrets();
  var geminiKey = secrets.GEMINI_API_KEY || '';
  var openaiKey = secrets.OPENAI_API_KEY || '';

  if (!geminiKey && !openaiKey) throw new Error('No AI API key configured');

  var isImage = base64 && ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].indexOf(mediaType) >= 0;
  var isPDF = base64 && mediaType === 'application/pdf';

  // Step 1: Parse invoice
  var userText = content
    ? 'Parse this invoice and return the JSON array.\n\nINVOICE:\n' + content.slice(0, 50000)
    : 'Parse this invoice and return the JSON array.';

  var parseRaw = '';

  // Try Gemini first
  if (geminiKey) {
    try {
      var parts = [];
      if (base64 && (isImage || isPDF)) {
        parts.push({ inline_data: { mime_type: mediaType, data: base64 } });
      }
      parts.push({ text: userText });
      parseRaw = await callGemini(geminiKey, parts, PARSE_PROMPT, false);
      console.log('[parse] Used: Gemini');
    } catch (geminiErr) {
      console.warn('[parse] Gemini failed:', geminiErr.message ? geminiErr.message.slice(0, 100) : 'unknown');
    }
  }

  // Fallback to OpenAI
  if (!parseRaw && openaiKey) {
    try {
      parseRaw = await callOpenAI(openaiKey, userText, PARSE_PROMPT, isImage, isPDF, base64, mediaType);
      console.log('[parse] Used: OpenAI (fallback)');
    } catch (openaiErr) {
      console.error('[parse] OpenAI also failed:', openaiErr.message ? openaiErr.message.slice(0, 100) : 'unknown');
      throw new Error('Both AI providers failed');
    }
  }

  if (!parseRaw) throw new Error('No AI response received');

  var parseClean = parseRaw.replace(/```json|```/g, '').trim();
  var items;
  try { items = JSON.parse(parseClean); }
  catch (e) {
    console.error('[parse] Raw output:', parseClean.slice(0, 500));
    throw new Error('AI returned invalid JSON');
  }
  if (!Array.isArray(items)) throw new Error('AI did not return an array');

  // Step 2: Check cache for hardware SKUs
  var uncachedItems = [];
  var dimResults = {};

  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    if (item.type !== 'hardware') continue;
    if (item.model) {
      var cached = await getCachedDims(item.model);
      if (cached) { dimResults[item.model] = cached; continue; }
    }
    uncachedItems.push(item);
  }

  console.log('[dims] ' + Object.keys(dimResults).length + ' cached, ' + uncachedItems.length + ' need lookup');

  // Step 3: Search for uncached items (limit to 5 to stay under 29s timeout)
  if (uncachedItems.length > 0) {
    var searchBatch = uncachedItems.slice(0, 5);
    if (uncachedItems.length > 5) {
      console.log('[search] Only searching first 5 of ' + uncachedItems.length + ' items');
    }

    var searchLines = [];
    for (var k = 0; k < searchBatch.length; k++) {
      var si = searchBatch[k];
      var line = (k + 1) + '. ' + si.name;
      if (si.model) line += ' (SKU: ' + si.model + ')';
      searchLines.push(line);
    }
    var searchText = 'Find exact shipping dimensions and weight for:\n' + searchLines.join('\n');

    var searchRaw = '';

    // Try Gemini with search
    if (geminiKey) {
      try {
        searchRaw = await callGemini(geminiKey, [{ text: searchText }], DIMS_PROMPT, true);
        console.log('[search] Used: Gemini');
      } catch (e) {
        console.warn('[search] Gemini failed:', e.message ? e.message.slice(0, 100) : 'unknown');
      }
    }

    // Fallback to OpenAI
    if (!searchRaw && openaiKey) {
      try {
        searchRaw = await callOpenAI(openaiKey, searchText, DIMS_PROMPT, false, false, null, null);
        console.log('[search] Used: OpenAI (fallback)');
      } catch (e) {
        console.warn('[search] OpenAI failed:', e.message ? e.message.slice(0, 100) : 'unknown');
      }
    }

    if (searchRaw) {
      var searchClean = searchRaw.replace(/```json|```/g, '').trim();
      console.log('[search] Raw result:', searchClean.slice(0, 300));
      try {
        var dims = JSON.parse(searchClean);
        if (Array.isArray(dims)) {
          for (var m = 0; m < dims.length; m++) {
            var d = dims[m];
            var sku = d.model || d.sku;
            if (sku && d.dimensions && d.dimensions !== 'N/A') {
              var entry = { dimensions: d.dimensions, weight: parseFloat(d.weight) || 0, name: d.name || '' };
              dimResults[sku] = entry;
              await cacheDims(sku, entry);
            }
          }
        }
      } catch (e) { console.warn('[search] JSON parse failed:', e.message); }
    }
  }

  // Step 4: Build final items with dims + fallbacks
  var finalItems = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var type = (it.type === 'hardware' || it.type === 'software') ? it.type : 'hardware';

    if (type === 'software') {
      finalItems.push({
        id: i + 1, name: String(it.name || 'Unknown'), model: it.model || null,
        type: 'software', qty: Math.max(1, parseInt(it.qty) || 1),
        unitPrice: Math.max(0, parseFloat(it.unitPrice) || 0),
        dimensions: null, weight: 0, dimSource: null
      });
      continue;
    }

    var dimensions = null;
    var weight = 0;
    var dimSource = 'fallback';

    if (it.model && dimResults[it.model]) {
      dimensions = dimResults[it.model].dimensions;
      weight = parseFloat(dimResults[it.model].weight) || 0;
      dimSource = 'verified';
    }

    if (!dimensions || weight === 0) {
      var fb = estimateDimsAndWeight(it.name);
      if (!dimensions) { dimensions = fb.dimensions; dimSource = 'fallback'; }
      if (weight === 0) weight = fb.weight;
    }

    finalItems.push({
      id: i + 1, name: String(it.name || 'Unknown'), model: it.model || null,
      type: 'hardware', qty: Math.max(1, parseInt(it.qty) || 1),
      unitPrice: Math.max(0, parseFloat(it.unitPrice) || 0),
      dimensions: dimensions, weight: weight, dimSource: dimSource
    });
  }

  var hwCount = finalItems.filter(function(x) { return x.type === 'hardware'; }).length;
  var swCount = finalItems.filter(function(x) { return x.type === 'software'; }).length;

  return { items: finalItems, hwCount: hwCount, swCount: swCount, total: finalItems.length };
};
