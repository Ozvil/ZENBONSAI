import React, { useEffect, useMemo, useRef, useState } from 'react'

/** ──────────────────────── Persistencia ──────────────────────── */
const LS_KEY = 'bonsaiKeeper:v1:data'
const LS_LANG = 'bonsaiKeeper:v1:lang'
const LS_ACH  = 'bonsaiKeeper:v1:ach'

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36) }
function nowISO(){ return new Date().toISOString() }
function fmt(d, lang){ try{ return new Date(d).toLocaleString(lang==='es'?'es-PE':'en-US') }catch{ return d } }

/** ──────────────────────── i18n ──────────────────────── */
const STR = {
  es: {
    app_title: 'ZenBonsai App',
    app_tag: 'Registra, identifica y cuida tu colección',
    search: 'Buscar…',
    all_species: 'Todas las especies',
    new: '+ Nuevo',
    empty_title: 'Aún no tienes bonsáis registrados',
    empty_sub: 'Agrega tu primer árbol y empecemo_
