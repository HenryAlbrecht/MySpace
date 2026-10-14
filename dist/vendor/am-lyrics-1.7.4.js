/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$1=globalThis,e$4=t$1.ShadowRoot&&(void 0===t$1.ShadyCSS||t$1.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s$2=Symbol(),o$4=new WeakMap;let n$3 = class n{constructor(t,e,o){if(this._$cssResult$=true,o!==s$2)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e;}get styleSheet(){let t=this.o;const s=this.t;if(e$4&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=o$4.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&o$4.set(s,t));}return t}toString(){return this.cssText}};const r$4=t=>new n$3("string"==typeof t?t:t+"",void 0,s$2),i$3=(t,...e)=>{const o=1===t.length?t[0]:e.reduce((e,s,o)=>e+(t=>{if(true===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[o+1],t[0]);return new n$3(o,t,s$2)},S$1=(s,o)=>{if(e$4)s.adoptedStyleSheets=o.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of o){const o=document.createElement("style"),n=t$1.litNonce;void 0!==n&&o.setAttribute("nonce",n),o.textContent=e.cssText,s.appendChild(o);}},c$2=e$4?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return r$4(e)})(t):t;

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:i$2,defineProperty:e$3,getOwnPropertyDescriptor:h$1,getOwnPropertyNames:r$3,getOwnPropertySymbols:o$3,getPrototypeOf:n$2}=Object,a$1=globalThis,c$1=a$1.trustedTypes,l$1=c$1?c$1.emptyScript:"",p$1=a$1.reactiveElementPolyfillSupport,d$1=(t,s)=>t,u$1={toAttribute(t,s){switch(s){case Boolean:t=t?l$1:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,s){let i=t;switch(s){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t);}catch(t){i=null;}}return i}},f$1=(t,s)=>!i$2(t,s),b$1={attribute:true,type:String,converter:u$1,reflect:false,useDefault:false,hasChanged:f$1};Symbol.metadata??=Symbol("metadata"),a$1.litPropertyMetadata??=new WeakMap;let y$1 = class y extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t);}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,s=b$1){if(s.state&&(s.attribute=false),this._$Ei(),this.prototype.hasOwnProperty(t)&&((s=Object.create(s)).wrapped=true),this.elementProperties.set(t,s),!s.noAccessor){const i=Symbol(),h=this.getPropertyDescriptor(t,i,s);void 0!==h&&e$3(this.prototype,t,h);}}static getPropertyDescriptor(t,s,i){const{get:e,set:r}=h$1(this.prototype,t)??{get(){return this[s]},set(t){this[s]=t;}};return {get:e,set(s){const h=e?.call(this);r?.call(this,s),this.requestUpdate(t,h,i);},configurable:true,enumerable:true}}static getPropertyOptions(t){return this.elementProperties.get(t)??b$1}static _$Ei(){if(this.hasOwnProperty(d$1("elementProperties")))return;const t=n$2(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties);}static finalize(){if(this.hasOwnProperty(d$1("finalized")))return;if(this.finalized=true,this._$Ei(),this.hasOwnProperty(d$1("properties"))){const t=this.properties,s=[...r$3(t),...o$3(t)];for(const i of s)this.createProperty(i,t[i]);}const t=this[Symbol.metadata];if(null!==t){const s=litPropertyMetadata.get(t);if(void 0!==s)for(const[t,i]of s)this.elementProperties.set(t,i);}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const i=this._$Eu(t,s);void 0!==i&&this._$Eh.set(i,t);}this.elementStyles=this.finalizeStyles(this.styles);}static finalizeStyles(s){const i=[];if(Array.isArray(s)){const e=new Set(s.flat(1/0).reverse());for(const s of e)i.unshift(c$2(s));}else void 0!==s&&i.push(c$2(s));return i}static _$Eu(t,s){const i=s.attribute;return  false===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=false,this.hasUpdated=false,this._$Em=null,this._$Ev();}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this));}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.();}removeController(t){this._$EO?.delete(t);}_$E_(){const t=new Map,s=this.constructor.elementProperties;for(const i of s.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t);}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return S$1(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(true),this._$EO?.forEach(t=>t.hostConnected?.());}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.());}attributeChangedCallback(t,s,i){this._$AK(t,i);}_$ET(t,s){const i=this.constructor.elementProperties.get(t),e=this.constructor._$Eu(t,i);if(void 0!==e&&true===i.reflect){const h=(void 0!==i.converter?.toAttribute?i.converter:u$1).toAttribute(s,i.type);this._$Em=t,null==h?this.removeAttribute(e):this.setAttribute(e,h),this._$Em=null;}}_$AK(t,s){const i=this.constructor,e=i._$Eh.get(t);if(void 0!==e&&this._$Em!==e){const t=i.getPropertyOptions(e),h="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:u$1;this._$Em=e;const r=h.fromAttribute(s,t.type);this[e]=r??this._$Ej?.get(e)??r,this._$Em=null;}}requestUpdate(t,s,i,e=false,h){if(void 0!==t){const r=this.constructor;if(false===e&&(h=this[t]),i??=r.getPropertyOptions(t),!((i.hasChanged??f$1)(h,s)||i.useDefault&&i.reflect&&h===this._$Ej?.get(t)&&!this.hasAttribute(r._$Eu(t,i))))return;this.C(t,s,i);} false===this.isUpdatePending&&(this._$ES=this._$EP());}C(t,s,{useDefault:i,reflect:e,wrapped:h},r){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??s??this[t]),true!==h||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||i||(s=void 0),this._$AL.set(t,s)),true===e&&this._$Em!==t&&(this._$Eq??=new Set).add(t));}async _$EP(){this.isUpdatePending=true;try{await this._$ES;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,s]of this._$Ep)this[t]=s;this._$Ep=void 0;}const t=this.constructor.elementProperties;if(t.size>0)for(const[s,i]of t){const{wrapped:t}=i,e=this[s];true!==t||this._$AL.has(s)||void 0===e||this.C(s,void 0,i,e);}}let t=false;const s=this._$AL;try{t=this.shouldUpdate(s),t?(this.willUpdate(s),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(s)):this._$EM();}catch(s){throw t=false,this._$EM(),s}t&&this._$AE(s);}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=true,this.firstUpdated(t)),this.updated(t);}_$EM(){this._$AL=new Map,this.isUpdatePending=false;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return  true}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM();}updated(t){}firstUpdated(t){}};y$1.elementStyles=[],y$1.shadowRootOptions={mode:"open"},y$1[d$1("elementProperties")]=new Map,y$1[d$1("finalized")]=new Map,p$1?.({ReactiveElement:y$1}),(a$1.reactiveElementVersions??=[]).push("2.1.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,i$1=t=>t,s$1=t.trustedTypes,e$2=s$1?s$1.createPolicy("lit-html",{createHTML:t=>t}):void 0,h="$lit$",o$2=`lit$${Math.random().toFixed(9).slice(2)}$`,n$1="?"+o$2,r$2=`<${n$1}>`,l=document,c=()=>l.createComment(""),a=t=>null===t||"object"!=typeof t&&"function"!=typeof t,u=Array.isArray,d=t=>u(t)||"function"==typeof t?.[Symbol.iterator],f="[ \t\n\f\r]",v=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,_=/-->/g,m=/>/g,p=RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),g=/'/g,$=/"/g,y=/^(?:script|style|textarea|title)$/i,x=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),b=x(1),w=x(2),E=Symbol.for("lit-noChange"),A=Symbol.for("lit-nothing"),C=new WeakMap,P=l.createTreeWalker(l,129);function V(t,i){if(!u(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==e$2?e$2.createHTML(i):i}const N=(t,i)=>{const s=t.length-1,e=[];let n,l=2===i?"<svg>":3===i?"<math>":"",c=v;for(let i=0;i<s;i++){const s=t[i];let a,u,d=-1,f=0;for(;f<s.length&&(c.lastIndex=f,u=c.exec(s),null!==u);)f=c.lastIndex,c===v?"!--"===u[1]?c=_:void 0!==u[1]?c=m:void 0!==u[2]?(y.test(u[2])&&(n=RegExp("</"+u[2],"g")),c=p):void 0!==u[3]&&(c=p):c===p?">"===u[0]?(c=n??v,d=-1):void 0===u[1]?d=-2:(d=c.lastIndex-u[2].length,a=u[1],c=void 0===u[3]?p:'"'===u[3]?$:g):c===$||c===g?c=p:c===_||c===m?c=v:(c=p,n=void 0);const x=c===p&&t[i+1].startsWith("/>")?" ":"";l+=c===v?s+r$2:d>=0?(e.push(a),s.slice(0,d)+h+s.slice(d)+o$2+x):s+o$2+(-2===d?i:x);}return [V(t,l+(t[s]||"<?>")+(2===i?"</svg>":3===i?"</math>":"")),e]};class S{constructor({strings:t,_$litType$:i},e){let r;this.parts=[];let l=0,a=0;const u=t.length-1,d=this.parts,[f,v]=N(t,i);if(this.el=S.createElement(f,e),P.currentNode=this.el.content,2===i||3===i){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes);}for(;null!==(r=P.nextNode())&&d.length<u;){if(1===r.nodeType){if(r.hasAttributes())for(const t of r.getAttributeNames())if(t.endsWith(h)){const i=v[a++],s=r.getAttribute(t).split(o$2),e=/([.?@])?(.*)/.exec(i);d.push({type:1,index:l,name:e[2],strings:s,ctor:"."===e[1]?I:"?"===e[1]?L:"@"===e[1]?z:H}),r.removeAttribute(t);}else t.startsWith(o$2)&&(d.push({type:6,index:l}),r.removeAttribute(t));if(y.test(r.tagName)){const t=r.textContent.split(o$2),i=t.length-1;if(i>0){r.textContent=s$1?s$1.emptyScript:"";for(let s=0;s<i;s++)r.append(t[s],c()),P.nextNode(),d.push({type:2,index:++l});r.append(t[i],c());}}}else if(8===r.nodeType)if(r.data===n$1)d.push({type:2,index:l});else {let t=-1;for(;-1!==(t=r.data.indexOf(o$2,t+1));)d.push({type:7,index:l}),t+=o$2.length-1;}l++;}}static createElement(t,i){const s=l.createElement("template");return s.innerHTML=t,s}}function M(t,i,s=t,e){if(i===E)return i;let h=void 0!==e?s._$Co?.[e]:s._$Cl;const o=a(i)?void 0:i._$litDirective$;return h?.constructor!==o&&(h?._$AO?.(false),void 0===o?h=void 0:(h=new o(t),h._$AT(t,s,e)),void 0!==e?(s._$Co??=[])[e]=h:s._$Cl=h),void 0!==h&&(i=M(t,h._$AS(t,i.values),h,e)),i}class R{constructor(t,i){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:i},parts:s}=this._$AD,e=(t?.creationScope??l).importNode(i,true);P.currentNode=e;let h=P.nextNode(),o=0,n=0,r=s[0];for(;void 0!==r;){if(o===r.index){let i;2===r.type?i=new k(h,h.nextSibling,this,t):1===r.type?i=new r.ctor(h,r.name,r.strings,this,t):6===r.type&&(i=new Z(h,this,t)),this._$AV.push(i),r=s[++n];}o!==r?.index&&(h=P.nextNode(),o++);}return P.currentNode=l,e}p(t){let i=0;for(const s of this._$AV) void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,i,s,e){this.type=2,this._$AH=A,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cv=e?.isConnected??true;}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t?.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=M(this,t,i),a(t)?t===A||null==t||""===t?(this._$AH!==A&&this._$AR(),this._$AH=A):t!==this._$AH&&t!==E&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):d(t)?this.k(t):this._(t);}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t));}_(t){this._$AH!==A&&a(this._$AH)?this._$AA.nextSibling.data=t:this.T(l.createTextNode(t)),this._$AH=t;}$(t){const{values:i,_$litType$:s}=t,e="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=S.createElement(V(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===e)this._$AH.p(i);else {const t=new R(e,this),s=t.u(this.options);t.p(i),this.T(s),this._$AH=t;}}_$AC(t){let i=C.get(t.strings);return void 0===i&&C.set(t.strings,i=new S(t)),i}k(t){u(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const h of t)e===i.length?i.push(s=new k(this.O(c()),this.O(c()),this,this.options)):s=i[e],s._$AI(h),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,s){for(this._$AP?.(false,true,s);t!==this._$AB;){const s=i$1(t).nextSibling;i$1(t).remove(),t=s;}}setConnected(t){ void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t));}}class H{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,i,s,e,h){this.type=1,this._$AH=A,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=h,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=A;}_$AI(t,i=this,s,e){const h=this.strings;let o=false;if(void 0===h)t=M(this,t,i,0),o=!a(t)||t!==this._$AH&&t!==E,o&&(this._$AH=t);else {const e=t;let n,r;for(t=h[0],n=0;n<h.length-1;n++)r=M(this,e[s+n],i,n),r===E&&(r=this._$AH[n]),o||=!a(r)||r!==this._$AH[n],r===A?t=A:t!==A&&(t+=(r??"")+h[n+1]),this._$AH[n]=r;}o&&!e&&this.j(t);}j(t){t===A?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"");}}class I extends H{constructor(){super(...arguments),this.type=3;}j(t){this.element[this.name]=t===A?void 0:t;}}class L extends H{constructor(){super(...arguments),this.type=4;}j(t){this.element.toggleAttribute(this.name,!!t&&t!==A);}}class z extends H{constructor(t,i,s,e,h){super(t,i,s,e,h),this.type=5;}_$AI(t,i=this){if((t=M(this,t,i,0)??A)===E)return;const s=this._$AH,e=t===A&&s!==A||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,h=t!==A&&(s===A||e);e&&this.element.removeEventListener(this.name,this,s),h&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t);}}class Z{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){M(this,t);}}const B=t.litHtmlPolyfillSupport;B?.(S,k),(t.litHtmlVersions??=[]).push("3.3.3");const D=(t,i,s)=>{const e=s?.renderBefore??i;let h=e._$litPart$;if(void 0===h){const t=s?.renderBefore??null;e._$litPart$=h=new k(i.insertBefore(c(),t),t,void 0,s??{});}return h._$AI(t),h};

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const s=globalThis;class i extends y$1{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0;}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=D(r,this.renderRoot,this.renderOptions);}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(true);}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(false);}render(){return E}}i._$litElement$=true,i["finalized"]=true,s.litElementHydrateSupport?.({LitElement:i});const o$1=s.litElementPolyfillSupport;o$1?.({LitElement:i});(s.litElementVersions??=[]).push("4.2.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const o={attribute:true,type:String,converter:u$1,reflect:false,hasChanged:f$1},r$1=(t=o,e,r)=>{const{kind:n,metadata:i}=r;let s=globalThis.litPropertyMetadata.get(i);if(void 0===s&&globalThis.litPropertyMetadata.set(i,s=new Map),"setter"===n&&((t=Object.create(t)).wrapped=true),s.set(r.name,t),"accessor"===n){const{name:o}=r;return {set(r){const n=e.get.call(this);e.set.call(this,r),this.requestUpdate(o,n,t,true,r);},init(e){return void 0!==e&&this.C(o,void 0,t,e),e}}}if("setter"===n){const{name:o}=r;return function(r){const n=this[o];e.call(this,r),this.requestUpdate(o,n,t,true,r);}}throw Error("Unsupported decorator location: "+n)};function n(t){return (e,o)=>"object"==typeof o?r$1(t,e,o):((t,e,o)=>{const r=e.hasOwnProperty(o);return e.constructor.createProperty(o,t),r?Object.getOwnPropertyDescriptor(e,o):void 0})(t,e,o)}

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function r(r){return n({...r,state:true,attribute:false})}

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const e$1=(e,t,c)=>(c.configurable=true,c.enumerable=true,Reflect.decorate&&"object"!=typeof t&&Object.defineProperty(e,t,c),c);

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function e(e,r){return (n,s,i)=>{const o=t=>t.renderRoot?.querySelector(e)??null;return e$1(n,s,{get(){return o(this)}})}}

/**
 * Config for GoogleService
 */
const CONFIG = {
  GOOGLE: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    FETCH_TIMEOUT_MS: 6000
  }
};
/**
 * Service for translating and romanizing text using Google Translate (unofficial API)
 */
class GoogleService {
  static delay(ms, signal) {
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, ms);
      const abort = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abort);
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', abort, {
        once: true
      });
    });
  }
  static fetchWithTimeout(url, timeoutMs = CONFIG.GOOGLE.FETCH_TIMEOUT_MS, parentSignal) {
    if (parentSignal?.aborted) {
      return Promise.reject(parentSignal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener('abort', abortFromParent, {
      once: true
    });
    return fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abortFromParent);
    });
  }
  static isPurelyLatinScript(text) {
    // Basic check for Latin script characters plus common punctuation and numbers
    // eslint-disable-next-line no-control-regex
    return /^[\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]*$/.test(text);
  }
  static async translate(textOrArray, targetLang, signal) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    if (!textOrArray || Array.isArray(textOrArray) && textOrArray.length === 0) {
      return Array.isArray(textOrArray) ? [] : '';
    }
    const isArray = Array.isArray(textOrArray);
    const texts = isArray ? textOrArray : [textOrArray];
    // Check for empty strings to preserve indices
    const nonEmptyIndices = [];
    const textsToTranslate = [];
    texts.forEach((t, i) => {
      if (t && t.trim()) {
        nonEmptyIndices.push(i);
        textsToTranslate.push(t);
      }
    });
    if (textsToTranslate.length === 0) {
      return isArray ? texts : texts[0];
    }
    // Batching logic: Google Translate URL limit is roughly 2000 chars.
    // We'll be conservative with 1500 chars per batch.
    const BATCH_SIZE_CHARS = 1500;
    const translatedResults = new Array(textsToTranslate.length).fill('');
    let currentBatch = [];
    let currentBatchIndices = [];
    let currentBatchLength = 0;
    const processBatch = async (batch, indices) => {
      if (batch.length === 0) return;
      const joinedText = batch.join('\n');
      let attempt = 0;
      let success = false;
      while (attempt < CONFIG.GOOGLE.MAX_RETRIES && !success && !signal?.aborted) {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joinedText)}`;
          // eslint-disable-next-line no-await-in-loop
          const response = await GoogleService.fetchWithTimeout(url, CONFIG.GOOGLE.FETCH_TIMEOUT_MS, signal);
          if (!response.ok) throw new Error(`Status ${response.status}`);
          // eslint-disable-next-line no-await-in-loop
          const data = await response.json();
          // data[0] contains segments.
          // With batching/newlines, Google sometimes returns one large segment with newlines,
          // or multiple segments. We need to reconstruct the full text first.
          const fullTranslation = data?.[0]?.map(seg => seg?.[0]).join('') || '';
          // Split by newline to get individual lines back
          const lines = fullTranslation.split('\n');
          // Edge case: Google might strip trailing newlines or add extra.
          // If we sent N lines, we expect N lines back approx.
          // However, empty lines in input were filtered out before sending.
          // So 'lines' should match 'batch'.
          // If mismatch, try to align? Or just take what we have.
          // If lines.length < batch.length, we might have lost some.
          // If lines.length > batch.length, maybe some line wrap?
          // We'll trust the split for now but ensure we don't overflow.
          indices.forEach((originalIdx, i) => {
            // Safe access
            if (i < lines.length) {
              translatedResults[originalIdx] = lines[i];
            } else {
              // Fallback if response is shorter
              translatedResults[originalIdx] = batch[i];
            }
          });
          success = true;
        } catch (e) {
          if (signal?.aborted) throw e;
          attempt += 1;
          if (attempt < CONFIG.GOOGLE.MAX_RETRIES) {
            // eslint-disable-next-line no-await-in-loop
            await GoogleService.delay(CONFIG.GOOGLE.RETRY_DELAY_MS * 2 ** (attempt - 1), signal);
          } else {
            // Fail: fill with original
            indices.forEach((originalIdx, i) => {
              translatedResults[originalIdx] = batch[i];
            });
          }
        }
      }
    };
    for (let i = 0; i < textsToTranslate.length; i += 1) {
      const text = textsToTranslate[i];
      if (currentBatchLength + text.length > BATCH_SIZE_CHARS) {
        // eslint-disable-next-line no-await-in-loop
        await processBatch(currentBatch, currentBatchIndices);
        currentBatch = [];
        currentBatchIndices = [];
        currentBatchLength = 0;
      }
      currentBatch.push(text);
      currentBatchIndices.push(i);
      currentBatchLength += text.length;
    }
    if (currentBatch.length > 0) {
      await processBatch(currentBatch, currentBatchIndices);
    }
    // Reconstruct final array
    const finalArray = [...texts];
    nonEmptyIndices.forEach((realIdx, mappedIdx) => {
      finalArray[realIdx] = translatedResults[mappedIdx];
    });
    return isArray ? finalArray : finalArray[0];
  }
  static async romanize(originalLyrics, signal) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    // Determine if we should treat as word-synced (has syllabus) or line-synced
    const lines = Array.isArray(originalLyrics) ? originalLyrics : originalLyrics.data || originalLyrics.content || [];
    if (!lines || lines.length === 0) return Array.isArray(originalLyrics) ? originalLyrics : [];
    // Check if word synced
    const isWordSynced = lines.some(l => l.isWordSynced !== false && Array.isArray(l.text) && l.text.length > 1);
    if (isWordSynced) {
      return this.romanizeWordSynced(lines, signal);
    }
    return this.romanizeLineSynced(lines, signal);
  }
  static async romanizeWordSynced(lines, signal) {
    return Promise.all(lines.map(async line => {
      if (!line.text || !Array.isArray(line.text) || line.text.length === 0 || line.romanizedText // Skip if already romanized
      ) return line;
      // Get the entire line text to romanize together for context-aware pronunciation
      const fullText = line.text.map(s => s.text).join('');
      // romanizeTexts expects an array of strings, so we pass an array of one
      const [romanizedFullLine] = await this.romanizeTexts([fullText], signal);
      const newSyllabus = line.text.map(s => ({
        ...s,
        romanizedText: s.romanizedText // Keep any existing syllabus romanization if provided by API natively
      }));
      return {
        ...line,
        text: newSyllabus,
        romanizedText: romanizedFullLine || ''
      };
    }));
  }
  static async romanizeLineSynced(lines, signal) {
    const linesToRomanize = lines.map(line => {
      // If already romanized, skip
      if (line.romanizedText) {
        return '';
      }
      // If it's line-synced, it usually has 1 syllable with the full text.
      if (Array.isArray(line.text) && line.text.length > 0) {
        return line.text.map(s => s.text).join('');
      }
      return '';
    });
    const romanizedLines = await this.romanizeTexts(linesToRomanize, signal);
    return lines.map((line, index) => ({
      ...line,
      romanizedText: romanizedLines[index] || ''
    }));
  }
  static async romanizeTexts(texts, signal) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const contextText = texts.join(' ');
    if (GoogleService.isPurelyLatinScript(contextText)) {
      return texts;
    }
    const romanizedTexts = [];
    /* eslint-disable no-await-in-loop */
    for (const text of texts) {
      if (!text || GoogleService.isPurelyLatinScript(text)) {
        romanizedTexts.push(text);
      } else {
        if (signal?.aborted) {
          throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        }
        let attempt = 0;
        let success = false;
        let lastError = null;
        while (attempt < CONFIG.GOOGLE.MAX_RETRIES && !success && !signal?.aborted) {
          try {
            const romanizeUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(text)}`;
            const response = await GoogleService.fetchWithTimeout(romanizeUrl, CONFIG.GOOGLE.FETCH_TIMEOUT_MS, signal);
            const data = await response.json();
            // Response format is [[["...","...","...","romanization"]],...]
            // or [null, ...] for English/Latin input where no romanization is needed
            const romanized = data?.[0]?.[0]?.[3] || text;
            romanizedTexts.push(romanized);
            success = true;
          } catch (error) {
            if (signal?.aborted) throw error;
            lastError = error;
            // eslint-disable-next-line no-console
            console.warn(`GoogleService: Error romanizing text (attempt ${attempt + 1}/${CONFIG.GOOGLE.MAX_RETRIES}):`, error);
            attempt += 1;
            if (attempt < CONFIG.GOOGLE.MAX_RETRIES) {
              await GoogleService.delay(CONFIG.GOOGLE.RETRY_DELAY_MS * 2 ** (attempt - 1), signal); // Exponential backoff
            }
          }
        }
        if (!success) {
          // eslint-disable-next-line no-console
          console.error(`GoogleService: Failed to romanize text after ${CONFIG.GOOGLE.MAX_RETRIES} attempts. Last error:`, lastError);
          romanizedTexts.push(text); // Fallback to original text
        }
      }
    }
    /* eslint-enable no-await-in-loop */
    return romanizedTexts;
  }
}

const VERSION = '1.7.4';
const INSTRUMENTAL_THRESHOLD_MS = 7000; // Show dots for gaps >= 7s
const FETCH_TIMEOUT_MS = 8000; // Timeout for all lyrics fetch requests
const SEEK_THRESHOLD_MS = 500;
const SCROLL_ANIMATION_DURATION_MS = 350;
const BACKGROUND_EXIT_DURATION_MS = 450;
const USER_SCROLL_RESUME_DELAY_MS = 5000;
const GAP_PULSE_DURATION_MS = 4000;
const GAP_ENTRY_FADE_MS = 160;
const GAP_ENTRY_SCALE_MS = 400;
const GAP_COLLAPSE_LEAD_MS = 500;
const GAP_EXIT_LEAD_MS = SCROLL_ANIMATION_DURATION_MS;
const GAP_EXIT_TRAIL_MS = 250;
const GAP_BREATH_MIN_SCALE = 0.85;
const GAP_BREATH_MAX_SCALE = 1.12;
const GAP_EXIT_POP_SCALE = 1.2;
const GAP_EXIT_POP_PROGRESS = 0.35;
const NEXT_WORD_PRE_WIPE_MAX_GAP_MS = 180;
const NEXT_WORD_PRE_WIPE_MIN_DURATION_MS = 80;
const NEXT_WORD_PRE_WIPE_MAX_DURATION_MS = 240;
const BASE_WIPE_GRADIENT_EM = 0.75;
const LONG_WORD_WIPE_EXTRA_EM = 0.45;
const LONG_WORD_WIPE_EXTRA_RATIO = 0.35;
const WORD_PRE_WIPE_HANDOFF_LEAD_MS = 100;
const NEXT_LINE_BASE_BLUR_EM = 0.02;
const NEXT_LINE_UNBLUR_DURATION_MS = 2000;
/**
 * Fetch with an automatic timeout via AbortSignal.
 * Rejects if the request takes longer than `timeoutMs`.
 */
function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const parentSignal = options.signal;
  if (parentSignal?.aborted) {
    return Promise.reject(parentSignal.reason ?? new DOMException('Aborted', 'AbortError'));
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener('abort', abortFromParent, {
    once: true
  });
  return fetch(url, {
    ...options,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: options.redirect ?? 'follow',
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', abortFromParent);
  });
}
const APPROVED_LYRICS_URL_HOSTS = new Set(['lrc.red', 'lyrics-api.binimum.org']);
function isApprovedLyricsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && APPROVED_LYRICS_URL_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}
const KPOE_SERVERS = ['https://lyricsplus.binimum.org', 'https://lyricsplus-seven.vercel.app', 'https://lyricsplus.prjktla.workers.dev', 'https://lyrics-plus-backend.vercel.app'];
const DEFAULT_KPOE_SOURCE_ORDER = 'apple,lyricsplus,musixmatch,spotify,qq,deezer,musixmatch-word';
const GENIUS_WORKER_URL = 'https://fetch-genius.samidy.workers.dev/';
class AmLyrics extends i {
  constructor() {
    super(...arguments);
    this.downloadFormat = 'auto';
    this.highlightColor = '#ffffff';
    this.autoScroll = true;
    this.interpolate = true;
    /** Use supplied alternates only; disable Google generation, including button actions. */
    this.noAutoAlternates = false;
    /** Disable distance and predictive blur without changing lyric timing. */
    this.noBlur = false;
    this.hidePlayedLines = false;
    /** Also enabled automatically by the system reduced-motion preference. */
    this.reducedMotion = false;
    /** Browser implementations; these are not the native app's version IDs. */
    this.lineMotion = 'staggered';
    this.systemReducedMotion = false;
    this.handleMotionPreference = event => {
      this.systemReducedMotion = event.matches;
    };
    this.showRomanization = false;
    this.showTranslation = false;
    this._currentTime = 0;
    this.rewindingLine = null;
    this.rewindFrame = 0;
    this.rewindEffects = [];
    this.isLoading = false;
    this.activeLineIndices = [];
    this.lyricsSource = null;
    this.availableSources = [];
    this.currentSourceIndex = 0;
    this.isFetchingAlternatives = false;
    this.hasFetchedAllProviders = false;
    this.hasCompletedLyricsFetch = false;
    this.lastInstrumentalIndex = null;
    this.isUserScrolling = false;
    this.isProgrammaticScroll = false;
    this.isClickSeeking = false;
    // Cached DOM elements for animation updates
    this.cachedLyricsLines = [];
    // Cached line elements array for scroll/position queries
    this.cachedLineArray = [];
    // Cached line and gap element maps for fast lookup
    this.lineElementCache = new Map();
    this.gapElementCache = new Map();
    this.gapAnimations = new Map();
    this.gapDotCache = new WeakMap();
    this.gapExitDurationCache = new WeakMap();
    this.gapCollapseDurationCache = new WeakMap();
    // Cached gap computation results
    this.cachedAllGaps = [];
    // Cached isUnsynced flag
    this.cachedIsUnsynced = false;
    // Cached pre-computed line data for render
    this.cachedLineData = null;
    // Active line tracking
    this.activeLineIds = new Set();
    this.currentPrimaryActiveLine = null;
    this.lastPrimaryActiveLine = null;
    this.backgroundExpandedLines = new Map();
    this.backgroundCollapseTimeouts = new Map();
    this.currentScrollOffset = 0;
    // Syllable animation tracking
    this.lastActiveIndex = 0;
    this.visibleLineIds = new Set();
    // Cached element tracking to avoid repeated querySelectorAll calls
    this.preActiveLineElements = [];
    this.progressiveBlurLine = null;
    this.positionedLineElements = [];
    this.activeGapLineElements = [];
    // Bound handler references for proper event listener removal
    this._boundHandleUserScroll = this.handleUserScroll.bind(this);
    this.pendingLayoutOffsets = new Map();
    this.lineSprings = new Map();
  }
  get shouldReduceMotion() {
    return this.reducedMotion || this.systemReducedMotion;
  }
  async toggleRomanization() {
    this.showRomanization = !this.showRomanization;
    await this.applyRomanization();
  }
  applyRomanization() {
    if (this.romanizationWork) return this.romanizationWork;
    const work = this.performRomanization();
    const trackedWork = work.finally(() => {
      if (this.romanizationWork === trackedWork) {
        this.romanizationWork = undefined;
      }
    });
    this.romanizationWork = trackedWork;
    return trackedWork;
  }
  async performRomanization() {
    if (this.noAutoAlternates) return;
    if (this.showRomanization && this.lyrics) {
      const sourceLyrics = this.lyrics;
      const signal = this.fetchAbortController?.signal;
      const needsRomanization = this.lyrics.some(l => !l.romanizedText && (!l.text || !l.text.some(s => s.romanizedText)));
      if (needsRomanization) {
        this.isLoading = true;
        try {
          const romanizedLines = await GoogleService.romanize(sourceLyrics, signal);
          if (!signal?.aborted && this.lyrics === sourceLyrics) {
            this.lyrics = romanizedLines;
          }
        } catch (e) {
          if (signal?.aborted) return;
          // eslint-disable-next-line no-console
          console.error('Romanization failed', e);
        } finally {
          if (!signal?.aborted) this.isLoading = false;
        }
      }
    }
  }
  async toggleTranslation() {
    this.showTranslation = !this.showTranslation;
    await this.applyTranslation();
  }
  applyTranslation() {
    if (this.translationWork) return this.translationWork;
    const work = this.performTranslation();
    const trackedWork = work.finally(() => {
      if (this.translationWork === trackedWork) {
        this.translationWork = undefined;
      }
    });
    this.translationWork = trackedWork;
    return trackedWork;
  }
  async performTranslation() {
    if (this.noAutoAlternates) return;
    if (this.showTranslation && this.lyrics) {
      const sourceLyrics = this.lyrics;
      const signal = this.fetchAbortController?.signal;
      const needsTranslation = this.lyrics.some(l => !l.translation);
      if (needsTranslation) {
        this.isLoading = true;
        try {
          // Prepare batch: extract text from all lines
          const textToTranslate = this.lyrics.map(line => {
            if (line.translation) return '';
            return line.text.map(s => s.text).join('');
          });
          // If all are empty, skip
          if (textToTranslate.every(t => !t)) {
            this.isLoading = false;
            return;
          }
          const result = await GoogleService.translate(textToTranslate, 'en', signal);
          if (signal?.aborted || this.lyrics !== sourceLyrics) return;
          const translations = Array.isArray(result) ? result : [result];
          const newLyrics = sourceLyrics.map((line, index) => {
            if (line.translation) return line;
            return {
              ...line,
              translation: translations[index] || undefined
            };
          });
          this.lyrics = newLyrics;
        } catch (e) {
          if (signal?.aborted) return;
          // eslint-disable-next-line no-console
          console.error('Translation failed', e);
        } finally {
          if (!signal?.aborted) this.isLoading = false;
        }
      }
    }
  }
  finishLineRewind() {
    cancelAnimationFrame(this.rewindFrame);
    this.rewindFrame = 0;
    for (const {
      animation
    } of this.rewindEffects) {
      if (Number(animation.currentTime) < Number(animation.effect?.getComputedTiming().endTime)) {
        const time = animation.currentTime;
        animation.play();
        // play() rewinds negative local times to zero. Negative times are valid
        // here because CSS wipes/glow may have started with a negative delay.
        animation.currentTime = time;
      }
    }
    this.rewindEffects = [];
    this.rewindingLine = null;
  }
  startLineRewind(line, targetTime) {
    this.finishLineRewind();
    this.rewindingLine = line;
    // Use the existing painted pose, even when another rewind is interrupted.
    // Only the short seek transition needs JS; normal playback stays compositor-driven.
    line.getAnimations({
      subtree: true
    }).forEach(animation => {
      const effect = animation.effect;
      const target = effect?.target;
      if (!(target instanceof HTMLElement)) return;
      const name = 'animationName' in animation ? String(animation.animationName) : '';
      const syllable = target.closest('.lyrics-syllable');
      let to;
      if (name.includes('wipe') && syllable) {
        to = targetTime - Number(syllable.dataset.startTime) + Number(effect.getTiming().delay);
      } else {
        const char = target.classList.contains('char-motion') ? target.querySelector('.char') : target;
        const entry = char && AmLyrics.characterAnimations.get(char);
        if (!entry || entry.animation !== animation && name !== 'char-glow') return;
        to = targetTime - entry.start - (name === 'char-glow' ? entry.glowEpoch : 0);
      }
      const end = Number(effect.getComputedTiming().endTime);
      this.rewindEffects.push({
        animation,
        from: Number(animation.currentTime || 0),
        to: Math.min(to, end)
      });
      animation.pause();
    });
    line.querySelectorAll('.lyrics-syllable.finished').forEach(syllable => syllable.classList.remove('finished'));
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / 260);
      const eased = progress * progress * (3 - 2 * progress);
      const playbackAdvance = this.currentTime - targetTime;
      for (const {
        animation,
        from,
        to
      } of this.rewindEffects) animation.currentTime = from + (to + playbackAdvance - from) * eased;
      if (progress < 1) {
        this.rewindFrame = requestAnimationFrame(tick);
      } else {
        this.finishLineRewind();
        AmLyrics.updateSyllablesForLine(line, this.currentTime);
      }
    };
    this.rewindFrame = requestAnimationFrame(tick);
  }
  set currentTime(value) {
    const oldValue = this._currentTime;
    const previousLine = value < oldValue || this.rewindingLine ? this.getLineIndexAtTime(oldValue) : -1;
    const sameLineRewind = oldValue - value > 80 && previousLine >= 0 && previousLine === this.getLineIndexAtTime(value);
    if (sameLineRewind) {
      const line = this._getLineElement(previousLine);
      if (line && !this.shouldReduceMotion) this.startLineRewind(line, value);
    } else if (this.rewindingLine && previousLine !== this.getLineIndexAtTime(value)) {
      this.finishLineRewind();
    }
    // A same-line seek preserves the backing layout and reverses existing motion.
    if (!sameLineRewind && value < oldValue && oldValue - value > 1000 && this.lyrics) {
      this.activeLineIndices = [];
      this.preActiveLineElements = [];
      this.positionedLineElements = [];
      this.clearGapAnimations();
      this.activeGapLineElements = [];
      this.clearBackgroundExpandedLine();
      // Stop all running animations and clear highlights immediately
      if (this.lyricsContainer) {
        const activeLines = this.lyricsContainer.querySelectorAll('.lyrics-line.active, .lyrics-line.pre-active, .lyrics-line.bg-expanded, .lyrics-line.scroll-exiting');
        activeLines.forEach(line => {
          line.classList.remove('active', 'pre-active', 'bg-expanded', 'scroll-exiting', 'progressive-unblur');
          line.style.removeProperty('filter');
          AmLyrics.resetSyllables(line);
        });
        const activeGaps = this.lyricsContainer.querySelectorAll('.lyrics-gap.active, .lyrics-gap.gap-collapsing, .lyrics-gap.gap-exiting');
        activeGaps.forEach(gap => gap.classList.remove('active', 'gap-collapsing', 'gap-exiting'));
        // Reset gap cache since we manually messed with the elements
        this.gapElementCache.clear();
      }
    }
    this._currentTime = value;
    if (oldValue !== value && this.lyrics) {
      this._onTimeChanged(oldValue, value);
    }
  }
  get currentTime() {
    return this._currentTime;
  }
  _updateFooter() {
    const footer = this.shadowRoot?.querySelector('.lyrics-footer');
    if (!footer) return;
    const switchBtn = footer.querySelector('.source-switch-btn');
    const svgEl = footer.querySelector('.source-switch-svg');
    const labelEl = footer.querySelector('.source-switch-label');
    if (switchBtn) {
      switchBtn.disabled = this.isFetchingAlternatives;
    }
    if (svgEl) {
      svgEl.classList.toggle('is-loading', this.isFetchingAlternatives);
    }
    if (labelEl) {
      labelEl.textContent = this.isFetchingAlternatives ? 'Switching...' : 'Switch';
    }
  }
  connectedCallback() {
    super.connectedCallback();
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.systemReducedMotion = this.motionPreference.matches;
    this.motionPreference.addEventListener('change', this.handleMotionPreference);
    if (!this.hasCompletedLyricsFetch) this.fetchLyrics();
  }
  disconnectedCallback() {
    this.finishLineRewind();
    this.pendingLayoutOffsets.clear();
    this.clearGapAnimations();
    super.disconnectedCallback();
    this.motionPreference?.removeEventListener('change', this.handleMotionPreference);
    this.motionPreference = undefined;
    this.cancelLineScrollAnimation();
    this.lyricsContainer?.querySelectorAll('.native-motion').forEach(char => AmLyrics.clearCharacterMotion(char));
    if (this.userScrollTimeoutId) {
      clearTimeout(this.userScrollTimeoutId);
      this.userScrollTimeoutId = undefined;
    }
    if (this.clickSeekTimeout) {
      clearTimeout(this.clickSeekTimeout);
      this.clickSeekTimeout = undefined;
    }
    for (const timeoutId of this.backgroundCollapseTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.backgroundCollapseTimeouts.clear();
    // Cancel any in-flight fetch requests
    this.fetchAbortController?.abort();
    this.fetchAbortController = undefined;
    this.romanizationWork = undefined;
    this.translationWork = undefined;
    // Remove scroll event listeners
    if (this.lyricsContainer) {
      this.lyricsContainer.removeEventListener('wheel', this._boundHandleUserScroll);
      this.lyricsContainer.removeEventListener('touchmove', this._boundHandleUserScroll);
    }
    this.preActiveLineElements = [];
    this.positionedLineElements = [];
    this.clearGapAnimations();
    this.activeGapLineElements = [];
    this.lastInstrumentalIndex = null;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
  }
  async fetchLyrics() {
    // Cancel any in-flight fetch to prevent stale results from racing
    this.fetchAbortController?.abort();
    const controller = new AbortController();
    this.fetchAbortController = controller;
    this.hasCompletedLyricsFetch = false;
    this.isLoading = true;
    this.lyrics = undefined;
    this.lyricsSource = null;
    this.availableSources = [];
    this.currentSourceIndex = 0;
    this.isFetchingAlternatives = false;
    this.hasFetchedAllProviders = false;
    this._updateFooter();
    try {
      if (this.ttml !== undefined) {
        const parseResult = AmLyrics.parseTTML(this.ttml);
        if (parseResult && parseResult.lines.length > 0) {
          this.lyrics = parseResult.lines;
          this.lyricsSource = 'Local';
          if (parseResult.songwriters) {
            this.songwriters = parseResult.songwriters;
          }
          this.availableSources = [{
            lines: this.lyrics,
            source: 'Local',
            originalTTML: this.ttml,
            songwriters: this.songwriters
          }];
          this.currentSourceIndex = 0;
          this.hasFetchedAllProviders = true;
          this.hasCompletedLyricsFetch = true;
          this._updateFooter();
          await this.onLyricsLoaded();
          return;
        }
        this.lyrics = undefined;
        this.lyricsSource = null;
        this.hasFetchedAllProviders = true;
        this.hasCompletedLyricsFetch = true;
        this._updateFooter();
        return;
      }
      const lrcRedResult = await AmLyrics.fetchLyricsFromLrcRed(this.songTitle?.trim() || '', this.songArtist?.trim() || '', this.isrc?.trim(), {
        album: this.songAlbum?.trim(),
        durationMs: this.songDurationMs || this.duration
      }, this.query?.trim(), controller.signal);
      if (controller.signal.aborted) return;
      if (lrcRedResult) {
        this.availableSources = [lrcRedResult];
        this.lyrics = lrcRedResult.lines;
        this.lyricsSource = lrcRedResult.source;
        this.hasCompletedLyricsFetch = true;
        if (lrcRedResult.songwriters) {
          this.songwriters = lrcRedResult.songwriters;
        }
        this._updateFooter();
        await this.onLyricsLoaded();
        return;
      }
      const resolvedMetadata = await this.resolveSongMetadata(controller.signal);
      // If a newer fetch was triggered while we awaited, bail out
      if (controller.signal.aborted) return;
      const isMusicIdOnlyRequest = Boolean(this.musicId) && !this.songTitle && !this.songArtist && !this.query && !this.isrc;
      const collectedSources = [];
      if (resolvedMetadata?.metadata && !isMusicIdOnlyRequest) {
        const title = resolvedMetadata.metadata.title?.trim() || '';
        const artist = resolvedMetadata.metadata.artist?.trim() || '';
        const biniResult = await AmLyrics.fetchLyricsFromBiniLyrics(title, artist, resolvedMetadata.catalogIsrc, resolvedMetadata.metadata, controller.signal);
        if (controller.signal.aborted) return;
        if (biniResult && biniResult.lines.length > 0) {
          collectedSources.push(biniResult);
        }
        const hasWordSync = sources => sources.some(s => s.lines.some(l => l.isWordSynced || l.text && l.text.length > 1));
        if (collectedSources.length === 0 || !hasWordSync(collectedSources)) {
          const unisonResult = await AmLyrics.fetchLyricsFromUnison(resolvedMetadata.metadata, controller.signal);
          if (controller.signal.aborted) return;
          if (unisonResult && unisonResult.lines.length > 0) {
            collectedSources.push(unisonResult);
          }
        }
        if (collectedSources.length === 0 || !hasWordSync(collectedSources)) {
          const youLyResults = await AmLyrics.fetchLyricsFromYouLyPlus(title, artist, resolvedMetadata.catalogIsrc, resolvedMetadata.metadata, true, controller.signal);
          if (controller.signal.aborted) return;
          if (youLyResults && youLyResults.length > 0) {
            collectedSources.push(...youLyResults);
          }
        }
      }
      const hasLineSync = sources => sources.some(s => s.lines.some(l => l.timestamp > 0 || l.endtime > 0));
      if ((collectedSources.length === 0 || !hasLineSync(collectedSources)) && resolvedMetadata?.metadata) {
        // Fallback: LRCLIB
        const lrclibResult = await AmLyrics.fetchLyricsFromLrclib(resolvedMetadata.metadata, controller.signal);
        if (controller.signal.aborted) return;
        if (lrclibResult && lrclibResult.lines.length > 0) {
          collectedSources.push({
            lines: lrclibResult.lines,
            source: 'LRCLIB'
          });
        }
      }
      if (collectedSources.length === 0 && resolvedMetadata?.metadata) {
        const geniusResult = await AmLyrics.fetchLyricsFromGenius(resolvedMetadata.metadata, controller.signal);
        if (controller.signal.aborted) return;
        if (geniusResult && geniusResult.lines.length > 0) {
          collectedSources.push({
            lines: geniusResult.lines,
            source: 'Genius'
          });
        }
      }
      this.hasFetchedAllProviders = collectedSources.length === 0 || collectedSources.some(s => s.source === 'LRCLIB' || s.source === 'Genius');
      this._updateFooter();
      if (collectedSources.length > 0) {
        this.availableSources = AmLyrics.mergeAndSortSources(collectedSources);
        this.currentSourceIndex = 0;
        const sourceResult = this.availableSources[0];
        this.lyrics = sourceResult.lines;
        this.lyricsSource = sourceResult.source;
        if (sourceResult.songwriters) {
          this.songwriters = sourceResult.songwriters;
        }
        this.hasCompletedLyricsFetch = true;
        await this.onLyricsLoaded();
        return;
      }
      this.lyrics = undefined;
      this.lyricsSource = null;
    } finally {
      // Only update loading state if this fetch wasn't superseded
      if (!controller.signal.aborted) {
        this.isLoading = false;
        this.hasCompletedLyricsFetch = true;
      }
    }
  }
  async onLyricsLoaded() {
    this.activeLineIndices = [];
    this.preActiveLineElements = [];
    this.positionedLineElements = [];
    this.clearGapAnimations();
    this.activeGapLineElements = [];
    this.lastInstrumentalIndex = null;
    this.clearBackgroundExpandedLine();
    if (this.lyricsContainer) {
      this.isProgrammaticScroll = true;
      this.lyricsContainer.scrollTop = 0;
      window.setTimeout(() => {
        this.isProgrammaticScroll = false;
      }, 100);
    }
    if (!this.noAutoAlternates) await this.autoProcessLyrics();
  }
  async autoProcessLyrics() {
    if (this.noAutoAlternates) return;
    if (this.showRomanization) {
      await this.applyRomanization();
    }
    if (this.showTranslation && !this.noAutoAlternates) {
      await this.applyTranslation();
    }
  }
  static getRankForCollected(sourceLabel, parsedLines) {
    const lower = sourceLabel.toLowerCase();
    if (lower === 'lrc.red') return 0;
    const hasWordSync = parsedLines.some(line => line.text && Array.isArray(line.text) && line.text.length > 1);
    const isUnsynced = parsedLines.length > 0 && parsedLines.every(line => line.timestamp === 0 && line.endtime === 0);
    const isQQ = lower.includes('qq') || lower.includes('lyricsplus');
    if (lower.includes('apple') && hasWordSync) return 1;
    if (lower.includes('bini') && hasWordSync) return 2;
    if (lower.includes('unison') && hasWordSync) return 3;
    if (isQQ && hasWordSync) return 4;
    if (lower.includes('musixmatch') && hasWordSync) return 5;
    if (lower.includes('lrclib') && hasWordSync) return 6;
    if (hasWordSync) return 7;
    if (lower.includes('apple') && !hasWordSync && !isUnsynced) return 8;
    if (lower.includes('bini') && !hasWordSync && !isUnsynced) return 9;
    if (lower.includes('unison') && !hasWordSync && !isUnsynced) return 10;
    if (isQQ && !hasWordSync && !isUnsynced) return 11;
    if (lower.includes('musixmatch') && !hasWordSync && !isUnsynced) return 12;
    if (lower.includes('lrclib') && !hasWordSync && !isUnsynced) return 13;
    if (!hasWordSync && !isUnsynced) return 14;
    if (lower.includes('apple') && isUnsynced) return 15;
    if (lower.includes('bini') && isUnsynced) return 16;
    if (lower.includes('unison') && isUnsynced) return 17;
    if (isQQ && isUnsynced) return 18;
    if (lower.includes('musixmatch') && isUnsynced) return 19;
    if (lower.includes('lrclib') && isUnsynced) return 20;
    if (lower.includes('genius')) return 21;
    return 30;
  }
  static getDisplaySourceLabel(sourceLabel) {
    return sourceLabel.toLowerCase().includes('lyricsplus') ? 'QQ' : sourceLabel;
  }
  static getSourceKey(sourceLabel) {
    const lower = (sourceLabel || '').trim().toLowerCase();
    if (!lower) return '';
    if (lower.includes('lyricsplus') || lower === 'qq') return 'qq';
    return lower.replace(/\s+/g, ' ');
  }
  static mergeAndSortSources(collectedSources) {
    const uniqueSourcesMap = new Map();
    for (const source of collectedSources) {
      const normalizedSource = AmLyrics.getDisplaySourceLabel(source.source);
      if (!uniqueSourcesMap.has(normalizedSource)) {
        uniqueSourcesMap.set(normalizedSource, {
          ...source,
          source: normalizedSource
        });
      }
    }
    return Array.from(uniqueSourcesMap.values()).sort((a, b) => AmLyrics.getRankForCollected(a.source, a.lines) - AmLyrics.getRankForCollected(b.source, b.lines));
  }
  findCurrentSourceIndex(sources = this.availableSources, sourceLabel = this.lyricsSource, lines = this.lyrics) {
    const identityIndex = sources.findIndex(source => source.lines === lines);
    if (identityIndex !== -1) return identityIndex;
    const sourceKey = AmLyrics.getSourceKey(sourceLabel);
    if (!sourceKey) return -1;
    return sources.findIndex(source => AmLyrics.getSourceKey(source.source) === sourceKey);
  }
  static getNextSourceIndex(sources, currentIndex, currentSourceLabel, currentLines) {
    if (sources.length <= 1) return -1;
    if (currentIndex !== -1) {
      return (currentIndex + 1) % sources.length;
    }
    const currentKey = AmLyrics.getSourceKey(currentSourceLabel);
    const fallbackIndex = sources.findIndex(source => source.lines !== currentLines && AmLyrics.getSourceKey(source.source) !== currentKey);
    return fallbackIndex === -1 ? 0 : fallbackIndex;
  }
  async applySourceAtIndex(index) {
    const sourceResult = this.availableSources[index];
    if (!sourceResult) return;
    this.currentSourceIndex = index;
    this.lyrics = sourceResult.lines;
    this.lyricsSource = sourceResult.source;
    if (sourceResult.songwriters) {
      this.songwriters = sourceResult.songwriters;
    }
    await this.onLyricsLoaded();
  }
  async switchSource() {
    if (this.isFetchingAlternatives) return;
    const signal = this.fetchAbortController?.signal;
    if (signal?.aborted) return;
    const currentSourceLabel = this.lyricsSource;
    const currentLines = this.lyrics;
    if (!this.hasFetchedAllProviders) {
      this.isFetchingAlternatives = true;
      this._updateFooter();
      try {
        const resolvedMetadata = await this.resolveSongMetadata(signal);
        if (signal?.aborted) return;
        if (resolvedMetadata?.metadata) {
          const newSources = [];
          if (!this.availableSources.some(s => s.source === 'BiniLyrics')) {
            const biniResult = await AmLyrics.fetchLyricsFromBiniLyrics(resolvedMetadata.metadata.title, resolvedMetadata.metadata.artist, resolvedMetadata.catalogIsrc, resolvedMetadata.metadata, signal);
            if (signal?.aborted) return;
            if (biniResult) newSources.push(biniResult);
          }
          // Try Unison if not fetched
          if (!this.availableSources.some(s => s.source.toLowerCase().includes('unison'))) {
            const unisonResult = await AmLyrics.fetchLyricsFromUnison(resolvedMetadata.metadata, signal);
            if (signal?.aborted) return;
            if (unisonResult && unisonResult.lines.length > 0) {
              newSources.push(unisonResult);
            }
          }
          // Try YouLyPlus (KPoe) if we don't have Apple or QQ
          if (!this.availableSources.some(s => s.source.toLowerCase().includes('apple') || s.source.toLowerCase().includes('qq'))) {
            const title = resolvedMetadata.metadata.title?.trim() || '';
            const artist = resolvedMetadata.metadata.artist?.trim() || '';
            const youLyResults = await AmLyrics.fetchLyricsFromYouLyPlus(title, artist, resolvedMetadata.catalogIsrc, resolvedMetadata.metadata, true, signal);
            if (signal?.aborted) return;
            if (youLyResults && youLyResults.length > 0) {
              newSources.push(...youLyResults);
            }
          }
          // Try LRCLIB if not fetched
          if (!this.availableSources.some(s => s.source.toLowerCase().includes('lrclib'))) {
            const lrclibResult = await AmLyrics.fetchLyricsFromLrclib(resolvedMetadata.metadata, signal);
            if (signal?.aborted) return;
            if (lrclibResult && lrclibResult.lines.length > 0) {
              newSources.push({
                lines: lrclibResult.lines,
                source: 'LRCLIB'
              });
            }
          }
          if (!this.availableSources.some(s => s.source.toLowerCase().includes('genius'))) {
            const geniusResult = await AmLyrics.fetchLyricsFromGenius(resolvedMetadata.metadata, signal);
            if (signal?.aborted) return;
            if (geniusResult && geniusResult.lines.length > 0) {
              newSources.push({
                lines: geniusResult.lines,
                source: 'Genius'
              });
            }
          }
          if (newSources.length > 0) {
            this.availableSources = AmLyrics.mergeAndSortSources([...this.availableSources, ...newSources]);
            // Re-sync current index since sorting or label normalization can
            // shift the currently displayed source underneath the old index.
            this.currentSourceIndex = this.findCurrentSourceIndex(this.availableSources, currentSourceLabel, currentLines);
          }
        }
      } finally {
        if (!signal?.aborted) {
          this.hasFetchedAllProviders = true;
        }
        this.isFetchingAlternatives = false;
        this._updateFooter();
      }
    }
    if (signal?.aborted) return;
    if (this.availableSources.length > 1) {
      const currentIndex = this.findCurrentSourceIndex(this.availableSources, currentSourceLabel, currentLines);
      const nextIndex = AmLyrics.getNextSourceIndex(this.availableSources, currentIndex, currentSourceLabel, currentLines);
      if (nextIndex !== -1) {
        await this.applySourceAtIndex(nextIndex);
      }
    }
  }
  async resolveSongMetadata(signal) {
    const metadata = {
      title: this.songTitle?.trim() ?? '',
      artist: this.songArtist?.trim() ?? '',
      album: this.songAlbum?.trim() || undefined,
      songwriters: this.songwriters?.trim() || undefined,
      durationMs: undefined
    };
    if (typeof this.songDurationMs === 'number' && this.songDurationMs > 0) {
      metadata.durationMs = this.songDurationMs;
    } else if (typeof this.duration === 'number' && this.duration > 0) {
      metadata.durationMs = this.duration;
    }
    const appleSong = null;
    let appleId = this.musicId;
    let catalogIsrc = this.isrc;
    if (this.query && (!metadata.title || !metadata.artist || !metadata.album)) {
      const parsed = AmLyrics.parseQueryMetadata(this.query);
      if (parsed) {
        if (!metadata.title && parsed.title) {
          metadata.title = parsed.title;
        }
        if (!metadata.artist && parsed.artist) {
          metadata.artist = parsed.artist;
        }
        if (!metadata.album && parsed.album) {
          metadata.album = parsed.album;
        }
      }
    }
    let catalogResult = null;
    if (this.query && (!metadata.title || !metadata.artist)) {
      catalogResult = await AmLyrics.searchLyricsPlusCatalog(this.query, signal);
      if (catalogResult) {
        if (!metadata.title && catalogResult.title) {
          metadata.title = catalogResult.title;
        }
        if (!metadata.artist && catalogResult.artist) {
          metadata.artist = catalogResult.artist;
        }
        if (!metadata.album && catalogResult.album) {
          metadata.album = catalogResult.album;
        }
        if (!metadata.songwriters && catalogResult.songwriters) {
          metadata.songwriters = catalogResult.songwriters;
        }
        if (metadata.durationMs == null && typeof catalogResult.durationMs === 'number' && catalogResult.durationMs > 0) {
          metadata.durationMs = catalogResult.durationMs;
        }
        if (!appleId && catalogResult.id?.appleMusic) {
          appleId = catalogResult.id.appleMusic;
        }
        if (!catalogIsrc && catalogResult.isrc) {
          catalogIsrc = catalogResult.isrc;
        }
      }
    }
    const trimmedTitle = metadata.title?.trim() ?? '';
    const trimmedArtist = metadata.artist?.trim() ?? '';
    const trimmedAlbum = metadata.album?.trim();
    const sanitizedDuration = typeof metadata.durationMs === 'number' && Number.isFinite(metadata.durationMs) && metadata.durationMs > 0 ? Math.round(metadata.durationMs) : undefined;
    const finalMetadata = trimmedTitle && trimmedArtist ? {
      title: trimmedTitle,
      artist: trimmedArtist,
      album: trimmedAlbum || undefined,
      durationMs: sanitizedDuration
    } : undefined;
    return {
      metadata: finalMetadata,
      appleId,
      appleSong,
      catalogIsrc
    };
  }
  static parseQueryMetadata(rawQuery) {
    const trimmed = rawQuery?.trim();
    if (!trimmed) return null;
    const result = {};
    const hyphenSplit = trimmed.split(/\s[-–—]\s/);
    if (hyphenSplit.length >= 2) {
      const [rawTitle, ...rest] = hyphenSplit;
      const rawArtist = rest.join(' - ');
      const titleCandidate = rawTitle.trim();
      const artistCandidate = rawArtist.trim();
      if (titleCandidate && artistCandidate) {
        result.title = titleCandidate;
        result.artist = artistCandidate;
        return result;
      }
    }
    const bySplit = trimmed.split(/\s+[bB]y\s+/);
    if (bySplit.length === 2) {
      const [maybeTitle, maybeArtist] = bySplit.map(part => part.trim());
      if (maybeTitle && maybeArtist) {
        result.title = maybeTitle;
        result.artist = maybeArtist;
        return result;
      }
    }
    return null;
  }
  static async searchLyricsPlusCatalog(searchTerm, signal) {
    const trimmedQuery = searchTerm?.trim();
    if (!trimmedQuery) return null;
    for (const base of KPOE_SERVERS) {
      const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const url = `${normalizedBase}/v1/songlist/search?q=${encodeURIComponent(trimmedQuery)}`;
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetchWithTimeout(url, {
          signal
        });
        if (response.ok) {
          // eslint-disable-next-line no-await-in-loop
          const payload = await response.json();
          let results = [];
          const typedPayload = payload;
          if (Array.isArray(typedPayload?.results)) {
            results = typedPayload.results;
          } else if (Array.isArray(payload)) {
            results = payload;
          }
          if (results.length > 0) {
            const primary = results.find(item => item?.id && item.id.appleMusic);
            return primary ?? results[0];
          }
        }
      } catch (error) {
        // Ignore and try next server
      }
    }
    return null;
  }
  static async fetchLyricsFromLrcRed(title, artist, isrc, metadata = {}, searchQuery = '', signal) {
    const fetchTTML = async trackIsrc => {
      try {
        const response = await fetchWithTimeout(`https://lrc.red/s/${encodeURIComponent(trackIsrc)}.ttml`, {
          signal
        });
        if (!response.ok) return null;
        const originalTTML = await response.text();
        const parsed = AmLyrics.parseTTML(originalTTML);
        if (!parsed?.lines.length) return null;
        return {
          lines: parsed.lines,
          source: 'lrc.red',
          originalTTML,
          songwriters: parsed.songwriters
        };
      } catch {
        return null;
      }
    };
    if (isrc) {
      const result = await fetchTTML(isrc);
      if (result) return result;
    }
    let url;
    if (title && artist) {
      const params = new URLSearchParams({
        track: title,
        artist
      });
      if (metadata.album) params.set('album', metadata.album);
      if (metadata.durationMs && Number.isFinite(metadata.durationMs) && metadata.durationMs > 0) {
        params.set('duration', Math.round(metadata.durationMs / 1000).toString());
      }
      url = `https://lrc.red/match.json?${params.toString()}`;
    } else if (searchQuery) {
      url = `https://lrc.red/search.json?${new URLSearchParams({
        q: searchQuery
      })}`;
    } else {
      return null;
    }
    try {
      const response = await fetchWithTimeout(url, {
        signal
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const hit = Array.isArray(payload?.hits) ? payload.hits[0] : undefined;
      if (typeof hit?.isrc === 'string' && hit.isrc.trim()) {
        return await fetchTTML(hit.isrc.trim());
      }
    } catch {
      // Continue with the existing providers when lrc.red is unavailable.
    }
    return null;
  }
  static async fetchLyricsFromBiniLyrics(title, artist, isrc, metadata = {}, signal) {
    if ((!title || !artist) && !isrc) return null;
    try {
      let cacheData = null;
      if (isrc) {
        try {
          const isrcUrl = `https://lyrics-api.binimum.org/?isrc=${encodeURIComponent(isrc)}`;
          const isrcRes = await fetchWithTimeout(isrcUrl, {
            signal
          });
          if (isrcRes.ok) {
            const data = await isrcRes.json();
            if (data.results && data.results.length > 0) {
              cacheData = data;
            }
          }
        } catch {
          // Fall through to title/artist search
        }
      }
      if (!cacheData && title && artist) {
        const cacheParams = new URLSearchParams({
          track: title,
          artist
        });
        if (metadata.album) {
          cacheParams.append('album', metadata.album);
        }
        if (metadata.durationMs && metadata.durationMs > 0) {
          cacheParams.append('duration', Math.round(metadata.durationMs / 1000).toString());
        }
        const cacheUrl = `https://lyrics-api.binimum.org/?${cacheParams.toString()}`;
        const cacheRes = await fetchWithTimeout(cacheUrl, {
          signal
        });
        if (cacheRes.ok) {
          cacheData = await cacheRes.json();
        }
      }
      if (cacheData && cacheData.results && cacheData.results.length > 0) {
        const result = cacheData.results[0];
        if (result.lyricsUrl) {
          if (!isApprovedLyricsUrl(result.lyricsUrl)) return null;
          const ttmlRes = await fetchWithTimeout(result.lyricsUrl, {
            signal,
            redirect: 'error'
          });
          if (ttmlRes.ok) {
            const ttmlText = await ttmlRes.text();
            const parseResult = AmLyrics.parseTTML(ttmlText);
            if (parseResult && parseResult.lines.length > 0) {
              return {
                lines: parseResult.lines,
                source: 'BiniLyrics',
                originalTTML: ttmlText,
                songwriters: parseResult.songwriters
              };
            }
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Cache API failed', e);
    }
    return null;
  }
  static async fetchLyricsFromYouLyPlus(title, artist, isrc, metadata = {}, skipBiniCache = false, signal) {
    if ((!title || !artist) && !isrc) return [];
    const params = new URLSearchParams();
    if (title) params.append('title', title);
    if (artist) params.append('artist', artist);
    if (isrc) params.append('isrc', isrc);
    if (metadata.album) {
      params.append('album', metadata.album);
    }
    if (metadata.durationMs && metadata.durationMs > 0) {
      params.append('duration', Math.round(metadata.durationMs / 1000).toString());
    }
    if (!DEFAULT_KPOE_SOURCE_ORDER.includes('apple')) {
      params.append('source', DEFAULT_KPOE_SOURCE_ORDER);
    }
    const getRank = (sourceLabel, parsedLines) => {
      const lower = sourceLabel.toLowerCase();
      const hasWordSync = parsedLines.some(line => line.text && Array.isArray(line.text) && line.text.length > 1);
      const isUnsynced = parsedLines.length > 0 && parsedLines.every(line => line.timestamp === 0 && line.endtime === 0);
      const isQQ = lower.includes('qq') || lower.includes('lyricsplus');
      if (lower.includes('apple') && hasWordSync) return 1;
      if (lower.includes('bini') && hasWordSync) return 2;
      if (lower.includes('unison') && hasWordSync) return 3;
      if (isQQ && hasWordSync) return 4;
      if (lower.includes('musixmatch') && hasWordSync) return 5;
      if (hasWordSync) return 6;
      if (lower.includes('apple') && !hasWordSync && !isUnsynced) return 7;
      if (lower.includes('bini') && !hasWordSync && !isUnsynced) return 8;
      if (lower.includes('unison') && !hasWordSync && !isUnsynced) return 9;
      if (isQQ && !hasWordSync && !isUnsynced) return 10;
      if (lower.includes('musixmatch') && !hasWordSync && !isUnsynced) return 11;
      if (!hasWordSync && !isUnsynced) return 12;
      if (lower.includes('apple') && isUnsynced) return 13;
      if (lower.includes('bini') && isUnsynced) return 14;
      if (lower.includes('unison') && isUnsynced) return 15;
      if (isQQ && isUnsynced) return 16;
      if (lower.includes('musixmatch') && isUnsynced) return 17;
      return 30;
    };
    const allResults = [];
    if (!skipBiniCache) {
      const biniResult = await AmLyrics.fetchLyricsFromBiniLyrics(title, artist, isrc, metadata, signal);
      if (biniResult) {
        allResults.push(biniResult);
        return allResults;
      }
    }
    // Shuffle servers so we pick a random one first, with all others as fallback
    // Try up to 3 servers to improve reliability when some have CORS or connectivity issues
    const shuffledServers = [...KPOE_SERVERS].sort(() => Math.random() - 0.5).slice(0, 3);
    const requestedServers = new Set();
    for (const base of shuffledServers) {
      if (signal?.aborted) return allResults;
      const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      requestedServers.add(normalizedBase);
      const url = `${normalizedBase}/v2/lyrics/get?${params.toString()}`;
      let payload = null;
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetchWithTimeout(url, {
          signal
        });
        if (response.ok) {
          // eslint-disable-next-line no-await-in-loop
          payload = await response.json();
        }
      } catch {
        payload = null;
      }
      if (payload) {
        const lines = AmLyrics.convertKPoeLyrics(payload);
        if (lines && lines.length > 0) {
          const sourceLabel = payload?.metadata?.source || payload?.metadata?.provider || 'LyricsPlus (KPoe)';
          const rank = getRank(sourceLabel, lines);
          const result = {
            lines,
            source: sourceLabel
          };
          allResults.push(result);
          // If source is Apple synced, we have the best so we can just immediately break the sweep
          if (rank === 1) {
            break;
          }
        }
      }
    }
    // If we haven't found a completely synced result (rank 1 or 2) among the servers,
    // force an explicit query against lyricsplus.binimum.org looking for word lyrics
    const hasHighRankResult = allResults.some(r => getRank(r.source, r.lines) <= 2);
    if (!hasHighRankResult && !requestedServers.has('https://lyricsplus.binimum.org') && !signal?.aborted) {
      try {
        const fallbackParams = new URLSearchParams(params);
        const url = `https://lyricsplus.binimum.org/v2/lyrics/get?${fallbackParams.toString()}`;
        const response = await fetchWithTimeout(url, {
          signal
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload) {
            const lines = AmLyrics.convertKPoeLyrics(payload);
            const sourceLabel = payload?.metadata?.source || payload?.metadata?.provider || 'LyricsPlus (KPoe)';
            const hasWordSync = lines?.some(line => line.text && Array.isArray(line.text) && line.text.length > 1);
            if (lines && lines.length > 0 && hasWordSync) {
              allResults.push({
                lines,
                source: sourceLabel
              });
            }
          }
        }
      } catch (error) {
        // Explicit fallback failed, ignore
      }
    }
    return allResults;
  }
  /**
   * Parse LRC subtitle format into LyricsLine[].
   * Handles "[mm:ss.xx] text" lines.
   */
  static parseLrcSubtitles(lrc) {
    if (!lrc || typeof lrc !== 'string') return [];
    const lines = [];
    const rawLines = lrc.split('\n');
    const parsed = [];
    for (const raw of rawLines) {
      const match = raw.match(/^\[(\d{1,3}):(\d{2})\.(\d{2,3})\]\s?(.*)$/);
      if (!match) {
        // Skip non-timestamped lines (headers like [ti:], [ar:], etc.)
        // eslint-disable-next-line no-continue
        continue;
      }
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let centiseconds = parseInt(match[3], 10);
      // Handle both mm:ss.xx (centiseconds) and mm:ss.xxx (milliseconds)
      if (match[3].length === 3) {
        centiseconds = Math.round(centiseconds / 10);
      }
      const timestamp = (minutes * 60 + seconds) * 1000 + centiseconds * 10;
      const text = match[4] || '';
      parsed.push({
        timestamp,
        text
      });
    }
    for (let i = 0; i < parsed.length; i += 1) {
      const {
        timestamp,
        text
      } = parsed[i];
      // Endtime is the start of the next line, or timestamp + 5s for the last line
      const endtime = i + 1 < parsed.length ? parsed[i + 1].timestamp : timestamp + 5000;
      // Skip empty lines (instrumental gaps)
      if (!text.trim()) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const syllable = {
        text,
        part: false,
        timestamp,
        endtime,
        lineSynced: true
      };
      lines.push({
        text: [syllable],
        background: false,
        backgroundText: [],
        oppositeTurn: false,
        timestamp,
        endtime,
        isWordSynced: false
      });
    }
    return lines;
  }
  /**
   * Fetch lyrics from LRCLIB.
   * Uses search endpoint, prefers synced lyrics.
   */
  static async fetchLyricsFromLrclib(metadata, signal) {
    const title = metadata.title?.trim();
    const artist = metadata.artist?.trim();
    if (!title || !artist) return null;
    try {
      const searchQuery = `${artist} ${title}`;
      const params = new URLSearchParams({
        q: searchQuery
      });
      const response = await fetchWithTimeout(`https://lrclib.net/api/search?${params.toString()}`, {
        headers: {
          'User-Agent': `apple-music-web-components/${VERSION}`
        },
        signal
      });
      if (!response.ok) return null;
      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) return null;
      // Prefer results with synced lyrics
      const withSynced = results.find(r => r.syncedLyrics && typeof r.syncedLyrics === 'string');
      const bestMatch = withSynced || results[0];
      // Try synced lyrics first
      if (bestMatch.syncedLyrics) {
        const lines = AmLyrics.parseLrcSubtitles(bestMatch.syncedLyrics);
        if (lines.length > 0) {
          return {
            lines,
            source: 'LRCLIB'
          };
        }
      }
      // Fall back to plain lyrics (unsynced)
      if (bestMatch.plainLyrics && typeof bestMatch.plainLyrics === 'string') {
        const plainLines = bestMatch.plainLyrics.split('\n').filter(l => l.trim());
        if (plainLines.length > 0) {
          const lines = plainLines.map(text => ({
            text: [{
              text,
              part: false,
              timestamp: 0,
              endtime: 0
            }],
            background: false,
            backgroundText: [],
            oppositeTurn: false,
            timestamp: 0,
            endtime: 0,
            isWordSynced: false
          }));
          return {
            lines,
            source: 'LRCLIB (unsynced)'
          };
        }
      }
    } catch {
      // LRCLIB fetch failed
    }
    return null;
  }
  static async fetchLyricsFromGenius(metadata, signal) {
    const title = metadata.title?.trim();
    const artist = metadata.artist?.trim();
    if (!title || !artist) return null;
    try {
      const params = new URLSearchParams({
        title,
        artist
      });
      const response = await fetchWithTimeout(`${GENIUS_WORKER_URL}?${params.toString()}`, {
        signal
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.lyrics) {
        const plainLines = data.lyrics.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('['));
        if (plainLines.length > 0) {
          const lines = plainLines.map(text => ({
            text: [{
              text,
              part: false,
              timestamp: 0,
              endtime: 0
            }],
            background: false,
            backgroundText: [],
            oppositeTurn: false,
            timestamp: 0,
            endtime: 0,
            isWordSynced: false
          }));
          return {
            lines,
            source: 'Genius'
          };
        }
      }
    } catch {
      // Genius fetch failed, will fall through to return null
    }
    return null;
  }
  static async fetchLyricsFromUnison(metadata, signal) {
    const title = metadata.title?.trim();
    const artist = metadata.artist?.trim();
    if (!title || !artist) return null;
    const params = new URLSearchParams();
    params.append('song', title);
    params.append('artist', artist);
    if (metadata.album) {
      params.append('album', metadata.album);
    }
    if (metadata.durationMs && metadata.durationMs > 0) {
      params.append('duration', Math.round(metadata.durationMs / 1000).toString());
    }
    try {
      const response = await fetchWithTimeout(`https://unison.boidu.dev/lyrics?${params.toString()}`, {
        signal
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.success || !data.data?.lyrics) return null;
      const lyricsData = data.data;
      const format = lyricsData.format || 'lrc';
      const syncType = lyricsData.syncType || 'linesync';
      const lyricsText = lyricsData.lyrics;
      if (format === 'ttml') {
        const parseResult = AmLyrics.parseTTML(lyricsText);
        if (parseResult && parseResult.lines.length > 0) {
          return {
            lines: parseResult.lines,
            source: 'Unison',
            songwriters: parseResult.songwriters
          };
        }
      }
      if (format === 'lrc') {
        if (syncType === 'plain') {
          const plainLines = lyricsText.split('\n').map(l => l.trim()).filter(l => l);
          if (plainLines.length > 0) {
            const lines = plainLines.map(text => ({
              text: [{
                text,
                part: false,
                timestamp: 0,
                endtime: 0
              }],
              background: false,
              backgroundText: [],
              oppositeTurn: false,
              timestamp: 0,
              endtime: 0,
              isWordSynced: false
            }));
            return {
              lines,
              source: 'Unison (unsynced)'
            };
          }
        } else {
          const lines = AmLyrics.parseLrcSubtitles(lyricsText);
          if (lines.length > 0) {
            return {
              lines,
              source: 'Unison'
            };
          }
        }
      }
    } catch {
      // Unison fetch failed
    }
    return null;
  }
  static calculateLineAlignments(lineSingers, agentTypes) {
    const lineSideAssignments = new Array(lineSingers.length).fill(undefined);
    let currentSideIsLeft = true;
    let lastPersonSingerId = null;
    let rightCount = 0;
    let totalCount = 0;
    lineSingers.forEach((singerId, index) => {
      let sideClass;
      if (singerId) {
        let type = agentTypes[singerId];
        if (!type) {
          if (singerId === 'v1000') {
            type = 'group';
          } else if (singerId === 'v2000') {
            type = 'other';
          } else {
            type = 'person';
          }
        }
        if (type === 'group') {
          sideClass = 'start';
        } else {
          if (lastPersonSingerId === null) {
            if (type === 'other') {
              currentSideIsLeft = false;
            } else {
              currentSideIsLeft = true;
            }
          } else if (singerId !== lastPersonSingerId) {
            currentSideIsLeft = !currentSideIsLeft;
          }
          sideClass = currentSideIsLeft ? 'start' : 'end';
          lastPersonSingerId = singerId;
        }
      }
      if (sideClass) {
        totalCount += 1;
        if (sideClass === 'end') rightCount += 1;
      }
      lineSideAssignments[index] = sideClass;
    });
    if (totalCount > 0 && Math.round(rightCount / totalCount * 100) >= 85) {
      const flip = s => {
        if (s === 'start') return 'end';
        if (s === 'end') return 'start';
        return s;
      };
      for (let i = 0; i < lineSideAssignments.length; i += 1) {
        lineSideAssignments[i] = flip(lineSideAssignments[i]);
      }
    }
    return lineSideAssignments;
  }
  static parseTTMLTime(value, fallback = 0) {
    if (!value) return fallback;
    const normalized = value.trim().toLowerCase();
    const unitMatch = normalized.match(/^(-?\d+(?:\.\d+)?)(ms|h|m|s)$/);
    if (unitMatch) {
      const amount = Number(unitMatch[1]);
      const multipliers = {
        ms: 1,
        s: 1000,
        m: 60_000,
        h: 3_600_000
      };
      return Math.max(0, Math.round(amount * multipliers[unitMatch[2]]));
    }
    const parts = normalized.split(':').map(Number);
    if (parts.some(part => !Number.isFinite(part))) return fallback;
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      [seconds] = parts;
    } else {
      return fallback;
    }
    return Math.max(0, Math.round(seconds * 1000));
  }
  static isRightToLeftLanguage(language) {
    if (!language) return false;
    const primaryLanguage = language.toLowerCase().split(/[-_]/)[0];
    return ['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'ur', 'yi'].includes(primaryLanguage);
  }
  static parseTTML(ttmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(ttmlString, 'text/xml');
      const translations = {};
      const transliterations = {};
      const agentMap = {};
      const documentLanguage = doc.documentElement.getAttribute('xml:lang') || doc.documentElement.getAttribute('lang');
      const agents = doc.getElementsByTagName('ttm:agent');
      for (let i = 0; i < agents.length; i += 1) {
        const agent = agents[i];
        const id = agent.getAttribute('xml:id');
        const type = agent.getAttribute('type');
        if (id && type) {
          agentMap[id] = type;
        }
      }
      let songwriters;
      const songwritersNodes = doc.getElementsByTagName('songwriter');
      if (songwritersNodes.length > 0) {
        const names = [];
        for (let i = 0; i < songwritersNodes.length; i += 1) {
          if (songwritersNodes[i].textContent) {
            names.push(songwritersNodes[i].textContent);
          }
        }
        if (names.length > 0) {
          songwriters = names.join(', ');
        }
      }
      const translationNodes = doc.getElementsByTagName('translation');
      for (let i = 0; i < translationNodes.length; i += 1) {
        const texts = translationNodes[i].getElementsByTagName('text');
        for (let j = 0; j < texts.length; j += 1) {
          const textNode = texts[j];
          const key = textNode.getAttribute('for');
          if (key && textNode.textContent) {
            translations[key] = textNode.textContent;
          }
        }
      }
      const timeToMs = AmLyrics.parseTTMLTime;
      const transliterationNodes = doc.getElementsByTagName('transliteration');
      for (let i = 0; i < transliterationNodes.length; i += 1) {
        const texts = transliterationNodes[i].getElementsByTagName('text');
        for (let j = 0; j < texts.length; j += 1) {
          const textNode = texts[j];
          const key = textNode.getAttribute('for');
          if (!key) {
            // eslint-disable-next-line no-continue
            continue;
          }
          const spans = Array.from(textNode.getElementsByTagName('span')).filter(span => span.getAttribute('begin'));
          if (spans.length > 0) {
            const syllabus = [];
            let fullText = '';
            for (let k = 0; k < spans.length; k += 1) {
              const span = spans[k];
              const begin = span.getAttribute('begin');
              const end = span.getAttribute('end');
              let spanText = span.textContent || '';
              const nextNode = span.nextSibling;
              if (nextNode && nextNode.nodeType === 3 && /^\s/.test(nextNode.textContent || '') && !spanText.endsWith(' ')) {
                spanText += ' ';
              }
              if (spanText.trim() === '') {
                // eslint-disable-next-line no-continue
                continue;
              }
              syllabus.push({
                time: timeToMs(begin),
                duration: timeToMs(end) - timeToMs(begin),
                text: spanText
              });
              fullText += spanText;
            }
            transliterations[key] = {
              text: fullText.trim(),
              syllabus
            };
          } else if (textNode.textContent) {
            transliterations[key] = {
              text: textNode.textContent.trim().replace(/\s+/g, ' ')
            };
          }
        }
      }
      const lines = [];
      const pNodes = doc.getElementsByTagName('p');
      for (let i = 0; i < pNodes.length; i += 1) {
        const p = pNodes[i];
        const key = p.getAttributeNS('http://lrc.red/lyric-ttml-internal', 'key') || p.getAttribute('itunes:key');
        const beginMs = timeToMs(p.getAttribute('begin'));
        const endMs = timeToMs(p.getAttribute('end'), beginMs);
        const agentId = p.getAttribute('ttm:agent') || undefined;
        const lineLanguage = p.getAttribute('xml:lang') || p.getAttribute('lang') || documentLanguage;
        let songPart;
        if (p.parentNode && p.parentNode.tagName === 'div') {
          songPart = p.parentNode.getAttributeNS('http://lrc.red/lyric-ttml-internal', 'songPart') || p.parentNode.getAttribute('itunes:songPart') || undefined;
        }
        const mainSyllables = [];
        const bgSyllables = [];
        const spans = p.getElementsByTagName('span');
        const hasWordLevelSync = Array.from(spans).some(span => {
          const isBackground = span.getAttribute('ttm:role') === 'x-bg' || span.parentNode?.getAttribute?.('ttm:role') === 'x-bg';
          return !isBackground && Boolean(span.getAttribute('begin')) && Boolean(span.getAttribute('end'));
        });
        if (spans.length > 0) {
          for (let j = 0; j < spans.length; j += 1) {
            const span = spans[j];
            if (span.getAttribute('ttm:role') === 'x-bg') {
              const bgInnerSpans = span.getElementsByTagName('span');
              for (let k = 0; k < bgInnerSpans.length; k += 1) {
                const bgSpan = bgInnerSpans[k];
                let bgText = bgSpan.textContent || '';
                const nextNode = bgSpan.nextSibling;
                if (nextNode && nextNode.nodeType === 3 && /^\s/.test(nextNode.textContent || '') && !bgText.endsWith(' ')) {
                  bgText += ' ';
                }
                const bgTimestamp = timeToMs(bgSpan.getAttribute('begin'), beginMs);
                bgSyllables.push({
                  text: bgText,
                  timestamp: bgTimestamp,
                  endtime: Math.max(bgTimestamp, timeToMs(bgSpan.getAttribute('end'), endMs)),
                  part: !/\s$/.test(bgText)
                });
              }
              // eslint-disable-next-line no-continue
              continue;
            }
            if (span.parentNode && span.parentNode.getAttribute?.('ttm:role') === 'x-bg') {
              // eslint-disable-next-line no-continue
              continue;
            }
            let text = span.textContent || '';
            const nextNode = span.nextSibling;
            if (nextNode && nextNode.nodeType === 3 && /^\s/.test(nextNode.textContent || '') && !text.endsWith(' ')) {
              text += ' ';
            }
            const syllableTimestamp = timeToMs(span.getAttribute('begin'), beginMs);
            mainSyllables.push({
              text,
              timestamp: syllableTimestamp,
              endtime: Math.max(syllableTimestamp, timeToMs(span.getAttribute('end'), endMs)),
              part: !/\s$/.test(text)
            });
          }
        }
        if (mainSyllables.length === 0) {
          const primaryLineText = Array.from(p.childNodes).filter(node => !(node instanceof Element && node.getAttribute('ttm:role') === 'x-bg')).map(node => node.textContent || '').join('').trim();
          mainSyllables.push({
            text: primaryLineText,
            timestamp: beginMs,
            endtime: endMs,
            part: false,
            lineSynced: true
          });
        }
        // Distribute line-level transliteration to individual syllables
        // so that per-syllable animated romanisation works (like KPoe lyrics)
        const lineTransliterationItem = key ? transliterations[key] : undefined;
        if (lineTransliterationItem && mainSyllables.length > 1 && spans.length > 0) {
          if (lineTransliterationItem.syllabus && lineTransliterationItem.syllabus.length === mainSyllables.length) {
            mainSyllables.forEach((syl, mapIdx) => {
              // eslint-disable-next-line no-param-reassign
              syl.romanizedText = lineTransliterationItem.syllabus[mapIdx].text;
            });
          } else {
            const lineTransliteration = lineTransliterationItem.text;
            const romanWords = lineTransliteration.split(/\s+/).filter(Boolean);
            const syllableGroups = [];
            for (let si = 0; si < mainSyllables.length; si += 1) {
              if (mainSyllables[si].part && syllableGroups.length > 0) {
                syllableGroups[syllableGroups.length - 1].push(si);
              } else {
                syllableGroups.push([si]);
              }
            }
            const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(mainSyllables.map(s => s.text).join(''));
            if (romanWords.length === syllableGroups.length) {
              syllableGroups.forEach((group, gi) => {
                // eslint-disable-next-line no-param-reassign
                mainSyllables[group[0]].romanizedText = romanWords[gi];
              });
            } else if (romanWords.length === mainSyllables.length) {
              mainSyllables.forEach((syl, mapIdx) => {
                // eslint-disable-next-line no-param-reassign
                syl.romanizedText = romanWords[mapIdx];
              });
            } else if (isCJK) {
              let romanIdx = 0;
              for (const group of syllableGroups) {
                const syl = mainSyllables[group[0]];
                const sylText = group.map(gIndex => mainSyllables[gIndex].text).join('');
                const validChars = sylText.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7afA-Za-z0-9]/g) || [];
                const needed = validChars.length;
                if (needed > 0 && romanIdx < romanWords.length) {
                  // eslint-disable-next-line no-param-reassign
                  syl.romanizedText = romanWords.slice(romanIdx, romanIdx + needed).join(' ');
                  romanIdx += needed;
                }
              }
            }
          }
        }
        const resolvedBeginMs = p.getAttribute('begin') ? beginMs : Math.min(...mainSyllables.map(syllable => syllable.timestamp));
        const resolvedEndMs = Math.max(endMs, resolvedBeginMs, ...mainSyllables.map(syllable => syllable.endtime), ...bgSyllables.map(syllable => syllable.endtime));
        lines.push({
          text: mainSyllables,
          background: bgSyllables.length > 0,
          backgroundText: bgSyllables,
          timestamp: resolvedBeginMs,
          endtime: resolvedEndMs,
          isWordSynced: hasWordLevelSync,
          songPart,
          translation: key ? translations[key] : undefined,
          romanizedText: lineTransliterationItem?.text,
          oppositeTurn: false,
          agentId,
          direction: p.getAttribute('dir') === 'rtl' || AmLyrics.isRightToLeftLanguage(lineLanguage) ? 'rtl' : undefined
        });
      }
      const sortedLines = lines.map((line, sourceIndex) => ({
        line,
        sourceIndex
      })).sort((a, b) => a.line.timestamp - b.line.timestamp || a.sourceIndex - b.sourceIndex).map(item => item.line);
      const alignments = AmLyrics.calculateLineAlignments(sortedLines.map(line => line.agentId), agentMap);
      const alignedLines = sortedLines.map((line, index) => ({
        ...line,
        alignment: alignments[index],
        oppositeTurn: alignments[index] === 'end'
      }));
      return {
        lines: alignedLines,
        songwriters
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse TTML', e);
      return null;
    }
  }
  static convertKPoeLyrics(payload) {
    if (!payload) {
      return null;
    }
    let rawLyrics = null;
    if (Array.isArray(payload?.lyrics)) {
      rawLyrics = payload.lyrics;
    } else if (Array.isArray(payload?.data?.lyrics)) {
      rawLyrics = payload.data.lyrics;
    } else if (Array.isArray(payload?.data)) {
      rawLyrics = payload.data;
    }
    if (!rawLyrics || rawLyrics.length === 0) {
      return null;
    }
    const sanitizedEntries = rawLyrics.filter(item => Boolean(item));
    const lines = [];
    // If type is 'Line', we revert to line-by-line highlighting by skipping syllabus parsing
    const isLineType = payload.type === 'Line' || payload.type === 'line';
    // Convert metadata.agents to type map
    const agentTypes = {};
    if (payload.metadata?.agents) {
      Object.entries(payload.metadata.agents).forEach(([key, agent]) => {
        const mappedKey = agent.alias || key;
        agentTypes[mappedKey] = agent.type;
      });
    }
    const lineSingers = sanitizedEntries.map(entry => entry.element?.singer);
    const alignments = AmLyrics.calculateLineAlignments(lineSingers, agentTypes);
    for (let i = 0; i < sanitizedEntries.length; i += 1) {
      const entry = sanitizedEntries[i];
      const alignment = alignments[i];
      const lineText = typeof entry.text === 'string' ? entry.text : '';
      const lineStart = AmLyrics.toMilliseconds(entry.time);
      const lineDuration = AmLyrics.toMilliseconds(entry.duration);
      const explicitEnd = AmLyrics.toMilliseconds(entry.endTime);
      const lineEnd = explicitEnd || lineStart + (lineDuration || 0);
      let syllabus = [];
      if (Array.isArray(entry.syllabus)) {
        syllabus = entry.syllabus.filter(s => Boolean(s));
      } else if (Array.isArray(entry.words)) {
        syllabus = entry.words.filter(s => Boolean(s));
      }
      const mainSyllables = [];
      const backgroundSyllables = [];
      if (!isLineType && syllabus.length > 0) {
        for (const syl of syllabus) {
          const sylStart = AmLyrics.toMilliseconds(syl.time, lineStart);
          const sylDuration = AmLyrics.toMilliseconds(syl.duration);
          // If there's only 1 syllable and duration is 0, it's likely a line-synced fallback.
          // Otherwise, it's an instantaneous boundary (like a space or comma) and should not span the line.
          const sylEnd = sylDuration === 0 && syllabus.length === 1 ? lineEnd : sylStart + sylDuration;
          const syllable = {
            text: typeof syl.text === 'string' ? syl.text : '',
            part: Boolean(syl.part),
            timestamp: sylStart,
            endtime: sylEnd
          };
          if (syl.isBackground) {
            backgroundSyllables.push(syllable);
          } else {
            mainSyllables.push(syllable);
          }
        }
      }
      if (mainSyllables.length === 0 && lineText) {
        mainSyllables.push({
          text: lineText,
          part: false,
          timestamp: lineStart,
          endtime: lineEnd || lineStart,
          lineSynced: isLineType // Mark as line-synced
        });
      }
      const hasWordSync = !isLineType && syllabus.length > 0 && (mainSyllables.length > 0 || backgroundSyllables.length > 0);
      const {
        transliteration
      } = entry;
      let romanizedTextFromPayload;
      if (transliteration) {
        romanizedTextFromPayload = transliteration.text;
        // If syllabus data matches, map it to main syllables
        if (Array.isArray(transliteration.syllabus) && transliteration.syllabus.length === mainSyllables.length) {
          transliteration.syllabus.forEach((s, idx) => {
            mainSyllables[idx].romanizedText = s.text;
          });
        }
      }
      // Extract translation from KPoe API if available
      const translationText = entry.translation?.text;
      const lineResult = {
        text: mainSyllables,
        background: backgroundSyllables.length > 0,
        backgroundText: backgroundSyllables,
        oppositeTurn: alignment === 'end' || (Array.isArray(entry.element) ? entry.element.includes('opposite') || entry.element.includes('right') : false),
        timestamp: lineStart,
        endtime: lineEnd,
        isWordSynced: isLineType ? false : hasWordSync,
        alignment,
        songPart: entry.element?.songPart,
        romanizedText: romanizedTextFromPayload,
        translation: translationText
      };
      lines.push(lineResult);
    }
    return lines;
  }
  static toMilliseconds(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return fallback;
    }
    if (!Number.isInteger(num)) {
      return Math.round(num * 1000);
    }
    return Math.max(0, Math.round(num));
  }
  firstUpdated() {
    // Set up scroll event listener for user scroll detection
    // Use wheel/touchmove which are guaranteed to be user initiated,
    // unlike 'scroll' which fires for both user and programmatic/inertia
    if (this.lyricsContainer) {
      this.lyricsContainer.addEventListener('wheel', this._boundHandleUserScroll, {
        passive: true
      });
      this.lyricsContainer.addEventListener('touchmove', this._boundHandleUserScroll, {
        passive: true
      });
    }
  }
  /**
   * Handle currentTime changes imperatively, bypassing Lit's render cycle.
   * This prevents the template from re-rendering on every frame, which would
   * reset imperative animation classes (highlight, finished, etc.) set by
   * updateSyllablesForLine.
   */
  _onTimeChanged(oldTime, newTime) {
    if (this.hidePlayedLines) this.updatePlayedLines(newTime);
    const timeDiff = Math.abs(newTime - oldTime);
    const isSeek = timeDiff > SEEK_THRESHOLD_MS;
    const newActiveLines = this.findActiveLineIndices(newTime);
    const oldActiveLines = this.activeLineIndices;
    // Reset animation if active lines change or if we skip time.
    const linesChanged = !AmLyrics.arraysEqual(newActiveLines, oldActiveLines);
    if (linesChanged || isSeek) {
      if (this.lyricsContainer) {
        // Remove .active and .bg-expanded immediately when a line drops.
        // All visual fading is handled by CSS transitions — no JS delays,
        // so overlapping lyrics never get stuck with multiple .active lines.
        for (const lineIndex of oldActiveLines) {
          if (!newActiveLines.includes(lineIndex)) {
            const lineElement = this._getLineElement(lineIndex);
            if (lineElement) {
              AmLyrics.unfinishSyllables(lineElement);
              lineElement.classList.remove('active', 'scroll-exiting');
              lineElement.classList.remove('progressive-unblur');
              lineElement.removeAttribute('aria-current');
              if (lineElement.classList.contains('pre-active')) {
                lineElement.classList.remove('pre-active');
              }
              lineElement.style.removeProperty('filter');
              const preIdx = this.preActiveLineElements.indexOf(lineElement);
              if (preIdx !== -1) this.preActiveLineElements.splice(preIdx, 1);
            }
          }
        }
        // Add 'active' to newly active lines. Background expansion is driven
        // separately by the current scroll target.
        for (const lineIndex of newActiveLines) {
          if (!oldActiveLines.includes(lineIndex) || isSeek) {
            const lineElement = this._getLineElement(lineIndex);
            if (lineElement) {
              lineElement.classList.add('active');
              lineElement.setAttribute('aria-current', 'true');
              lineElement.classList.remove('pre-active', 'scroll-exiting');
              lineElement.classList.remove('progressive-unblur');
              lineElement.style.removeProperty('filter');
              const preIdx = this.preActiveLineElements.indexOf(lineElement);
              if (preIdx !== -1) this.preActiveLineElements.splice(preIdx, 1);
            }
          }
        }
        // Remove pre-active from lines that are now active (they no longer
        // need the unblur preview class) and from lines that dropped.
        for (const lineElement of this.preActiveLineElements) {
          const idx = AmLyrics.getLineIndexFromElement(lineElement);
          if (idx === null || !newActiveLines.includes(idx) && lineElement !== this.currentPrimaryActiveLine) {
            lineElement.classList.remove('pre-active');
            lineElement.classList.remove('progressive-unblur');
            lineElement.style.removeProperty('filter');
          }
        }
        this.preActiveLineElements = this.preActiveLineElements.filter(el => el.classList.contains('pre-active'));
      }
      this.activeLineIndices = newActiveLines;
    }
    // Predictive scroll: run on every tick so we scroll *before* the next
    // line starts, matching YouLyPlus behaviour.
    this._handleActiveLineScroll(oldActiveLines, isSeek);
    if (linesChanged || isSeek) {
      this.clearPastLineHighlights();
    }
    if (this.lyricsContainer) {
      // Update syllables in active lines using cached elements
      for (const lineIndex of this.activeLineIndices) {
        const lineElement = this._getLineElement(lineIndex);
        if (lineElement && lineElement !== this.rewindingLine) {
          AmLyrics.updateSyllablesForLine(lineElement, newTime);
          if (isSeek) AmLyrics.seekLineWipes(lineElement, newTime);
        }
      }
      // Tie gap motion directly to playback time. This keeps the entrance,
      // breathing, sequential dots, and exit deterministic across seeks. Only
      // touch the current/previous gap instead of scanning every gap per frame.
      const currentGap = this.findInstrumentalGapAt(newTime);
      const gapElements = new Set(this.activeGapLineElements);
      if (currentGap) {
        const currentGapElement = this._getGapElement(currentGap.insertBeforeIndex);
        if (currentGapElement) gapElements.add(currentGapElement);
      }
      for (const gap of gapElements) {
        this.updateInstrumentalGap(gap, newTime);
      }
      // Track instrumental gap state
      if (currentGap) {
        if (currentGap.insertBeforeIndex !== this.lastInstrumentalIndex) {
          this.setBackgroundExpandedLine(null);
          if (this.autoScroll && !this.isUserScrolling && !this.isClickSeeking) {
            this.scrollToInstrumental(currentGap.insertBeforeIndex);
          }
        }
        this.lastInstrumentalIndex = currentGap.insertBeforeIndex;
        // Un-highlight the previous line immediately when gap dots are playing
        if (currentGap.insertBeforeIndex > 0) {
          const prevLine = this._getLineElement(currentGap.insertBeforeIndex - 1);
          if (prevLine && prevLine.classList.contains('persist-highlight') && !prevLine.classList.contains('active')) {
            AmLyrics.unfinishSyllables(prevLine);
          }
        }
      } else if (this.lastInstrumentalIndex !== null) {
        this.lastInstrumentalIndex = null;
      }
      // Check footer active state
      const lastLyric = this.lyrics && this.lyrics.length > 0 ? this.lyrics[this.lyrics.length - 1] : null;
      const footer = this.footerElement;
      if (footer && lastLyric && lastLyric.endtime > 0) {
        const isFooterActive = newTime > lastLyric.endtime + 200; // Snappier 200ms buffer
        if (isFooterActive && !footer.classList.contains('active')) {
          footer.classList.add('active');
          // Clear pre-active from the last lyric so it doesn't stay
          // unblurred when the footer takes over.
          const lastLine = this.lyrics ? this._getLineElement(this.lyrics.length - 1) : null;
          if (lastLine) {
            lastLine.classList.remove('pre-active');
            lastLine.classList.remove('progressive-unblur');
            lastLine.style.removeProperty('filter');
            const preIdx = this.preActiveLineElements.indexOf(lastLine);
            if (preIdx !== -1) this.preActiveLineElements.splice(preIdx, 1);
          }
          if (this.autoScroll && !this.isUserScrolling && !this.isClickSeeking) {
            this.focusLine(footer);
          }
        } else if (!isFooterActive && footer.classList.contains('active')) {
          footer.classList.remove('active');
        }
      }
    }
  }
  updatePlayedLines(time) {
    if (!this.lyrics) return;
    this.lyrics.forEach((line, index) => {
      const played = this.hidePlayedLines && this.getLineHighlightEndTime(index) > line.timestamp && time >= this.getLineHighlightEndTime(index);
      this._getLineElement(index)?.classList.toggle('played', played);
    });
  }
  willUpdate(changedProperties) {
    if (changedProperties.has('lyrics')) {
      this.cachedLineData = null;
      this._ensureLineDataCache();
    }
  }
  updated(changedProperties) {
    const lyricsDomBecameRenderable = changedProperties.has('lyrics') || changedProperties.has('isLoading') && !this.isLoading && Boolean(this.lyrics);
    if (lyricsDomBecameRenderable) {
      this._invalidateCaches();
      this._ensureLineDataCache();
      this._updateCachedIsUnsynced();
      // Recalculate timing data for accurate animations whenever lyrics change
      this._updateCharTimingData();
      // Apply 'active' classes imperatively after lyrics first render,
      // since the template no longer binds the 'active' class (to avoid
      // clobbering imperative scroll-animate classes on re-render).
      if (this.lyricsContainer && this.lyrics) {
        const activeLines = this.findActiveLineIndices(this.currentTime);
        for (const lineIndex of activeLines) {
          const lineEl = this._getLineElement(lineIndex);
          if (lineEl) {
            lineEl.classList.add('active');
            lineEl.setAttribute('aria-current', 'true');
          }
        }
        const primaryActiveLine = this.getPrimaryActiveLineIndex(activeLines);
        this.setBackgroundExpandedLine(primaryActiveLine !== null ? this._getLineElement(primaryActiveLine) : null);
        // Trigger a faux time-change so that updateSyllablesForLine fires
        // to setup inline syllable CSS wipe animations for whatever the current time is
        this._onTimeChanged(0, this.currentTime);
        // Ensure position classes are applied on initial render if not playing yet
        if (this.positionedLineElements.length === 0) {
          const firstLine = this.lyricsContainer.querySelector('.lyrics-line');
          if (firstLine) this.updatePositionClasses(firstLine);
        }
        // Set up IntersectionObserver for viewport virtualization
        this.visibilityObserver?.disconnect();
        this.visibilityObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            const el = entry.target;
            el.classList.toggle('far-line', !entry.isIntersecting);
          });
        }, {
          root: this.lyricsContainer,
          rootMargin: '200px',
          threshold: 0
        });
        const lines = this.lyricsContainer.querySelectorAll('.lyrics-line');
        lines.forEach(line => this.visibilityObserver.observe(line));
      }
    }
    if (lyricsDomBecameRenderable || changedProperties.has('hidePlayedLines')) {
      this.updatePlayedLines(this.currentTime);
    }
    if (changedProperties.has('noBlur') && this.noBlur) {
      this.clearProgressiveBlurLine();
    }
    if (changedProperties.has('reducedMotion') || changedProperties.has('systemReducedMotion') || changedProperties.has('lineMotion')) {
      this.cancelLineScrollAnimation();
      if (this.lyricsContainer) {
        // Cancel an in-flight native smooth scroll at its current position.
        this.lyricsContainer.scrollTo({
          top: this.lyricsContainer.scrollTop,
          behavior: 'instant'
        });
      }
      if (this.lyrics) this._onTimeChanged(this.currentTime, this.currentTime);
    }
    // Handle duration reset (-1 stops playback and resets currentTime to 0)
    if (changedProperties.has('duration') && this.duration === -1) {
      this.currentTime = 0;
      this.activeLineIndices = [];
      this.preActiveLineElements = [];
      this.positionedLineElements = [];
      this.clearGapAnimations();
      this.activeGapLineElements = [];
      this.clearBackgroundExpandedLine();
      this.setUserScrolling(false);
      // Cancel any running animations
      // Clear user scroll timeout
      if (this.userScrollTimeoutId) {
        clearTimeout(this.userScrollTimeoutId);
        this.userScrollTimeoutId = undefined;
      }
      this.cancelLineScrollAnimation();
      if (this.lyricsContainer) this.lyricsContainer.scrollTop = 0;
      return;
    }
    if ((changedProperties.has('query') || changedProperties.has('musicId') || changedProperties.has('isrc') || changedProperties.has('ttml') || changedProperties.has('songTitle') || changedProperties.has('songArtist') || changedProperties.has('songAlbum') || changedProperties.has('songDurationMs')) && !changedProperties.has('currentTime')) {
      this.fetchLyrics();
    }
    if (changedProperties.has('currentTime') && this.lyrics) ;
  }
  /**
   * Handle scrolling when active line indices change.
   * Called imperatively from _onTimeChanged instead of from updated().
   *
   * Uses predictive scroll like YouLyPlus: computes a scrollLookAheadMs based
   * on the gap to the next line, finds the primary line at predictiveTime,
   * and scrolls with a duration matching the lookahead.
   */
  _handleActiveLineScroll(_oldActiveIndices, forceScroll = false) {
    if (!this.lyricsContainer || !this.lyrics || this.lyrics.length === 0) {
      return;
    }
    // If the footer is already active, it set up its own scroll.
    // Don't override it with a scroll back to the last lyric.
    const footer = this.lyricsContainer.querySelector('.lyrics-footer');
    if (footer?.classList.contains('active')) {
      this.setBackgroundExpandedLine(null);
      return;
    }
    // 1. Compute scroll lookahead based on gap to next line (YouLyPlus style)
    let scrollLookAheadMs = 350;
    let currentAudioIndex = -1;
    for (let i = 0; i < this.lyrics.length; i += 1) {
      if (this.lyrics[i].timestamp > this.currentTime) {
        currentAudioIndex = i - 1;
        break;
      }
    }
    if (currentAudioIndex === -1 && this.lyrics.length > 0) {
      if (this.currentTime >= this.lyrics[this.lyrics.length - 1].timestamp) {
        currentAudioIndex = this.lyrics.length - 1;
      }
    }
    if (currentAudioIndex !== -1 && currentAudioIndex + 1 < this.lyrics.length) {
      const currentLine = this.lyrics[currentAudioIndex];
      const nextLine = this.lyrics[currentAudioIndex + 1];
      const gap = nextLine.timestamp - currentLine.endtime;
      scrollLookAheadMs = Math.min(500, Math.max(350, gap));
    }
    // Blur follows playback time, independently of predictive scrolling.
    const nextLineIndex = currentAudioIndex + 1;
    const nextLineElement = nextLineIndex >= 0 && nextLineIndex < this.lyrics.length ? this._getLineElement(nextLineIndex) : null;
    if (nextLineElement && !this.noBlur && !this.shouldReduceMotion && !this.isUserScrolling && this.lyricsContainer.classList.contains('blur-inactive-enabled') && !this.lyricsContainer.classList.contains('not-focused') && !nextLineElement.classList.contains('active') && !nextLineElement.classList.contains('lyrics-gap')) {
      if (this.progressiveBlurLine !== nextLineElement) {
        this.clearProgressiveBlurLine();
        this.progressiveBlurLine = nextLineElement;
      }
      const remainingTime = Math.max(0, this.lyrics[nextLineIndex].timestamp - this.currentTime);
      const blurEm = NEXT_LINE_BASE_BLUR_EM * AmLyrics.clamp(remainingTime / NEXT_LINE_UNBLUR_DURATION_MS, 0, 1);
      const blurValue = `blur(${blurEm.toFixed(4)}em)`;
      if (nextLineElement.style.filter !== blurValue) {
        nextLineElement.classList.add('progressive-unblur');
        nextLineElement.style.setProperty('filter', blurValue, 'important');
      }
    } else {
      this.clearProgressiveBlurLine();
    }
    // 2. Find scroll target at predictive time
    const predictiveTime = this.currentTime + scrollLookAheadMs;
    const predictiveActiveIndices = this.findActiveLineIndices(predictiveTime);
    let targetElement = null;
    let targetLineIndex = null;
    if (predictiveActiveIndices.length > 0) {
      targetLineIndex = this.getPrimaryScrollLineIndex(predictiveActiveIndices, predictiveTime);
      if (targetLineIndex !== null && targetLineIndex !== -1) {
        targetElement = this._getLineElement(targetLineIndex);
      }
    }
    if (!targetElement) {
      // Fallback: closest line before predictiveTime
      targetLineIndex = this.getLineIndexAtTime(predictiveTime, 0);
      if (targetLineIndex !== null && targetLineIndex !== -1) {
        targetElement = this._getLineElement(targetLineIndex);
      }
    }
    if (!targetElement) {
      return;
    }
    const scrollDuration = scrollLookAheadMs;
    if (targetElement !== this.currentPrimaryActiveLine || forceScroll) {
      targetElement.style.setProperty('--scroll-duration', `${scrollDuration}ms`);
    }
    // Unblur the upcoming target line early as the predictive scroll begins.
    if (!targetElement.classList.contains('active')) {
      targetElement.classList.add('pre-active');
      if (!this.preActiveLineElements.includes(targetElement)) {
        this.preActiveLineElements.push(targetElement);
      }
    }
    // Commit backing spacing before measuring the destination. Its displacement
    // and scrolling share the same spring rather than competing height tweens.
    const layoutChanged = this.setBackgroundExpandedLine(targetElement, true);
    this.focusLine(targetElement, forceScroll || layoutChanged, scrollDuration);
    if (this.pendingLayoutOffsets.size) this.finishLyricLayout(this.captureLyricLayout());
  }
  _getTextWidth(text, font) {
    if (!this._textWidthCanvas) {
      this._textWidthCanvas = document.createElement('canvas');
      this._textWidthCtx = this._textWidthCanvas.getContext('2d', {
        willReadFrequently: true
      });
    }
    if (this._textWidthCtx) {
      this._textWidthCtx.font = font;
      return this._textWidthCtx.measureText(text).width;
    }
    return 0;
  }
  _rebuildDomCache() {
    if (!this.lyricsContainer) return;
    this.lineElementCache.clear();
    this.gapElementCache.clear();
    this.footerElement = this.lyricsContainer.querySelector('.lyrics-footer') ?? undefined;
    this.cachedLineArray = [];
    if (!this.lyrics) return;
    for (let i = 0; i < this.lyrics.length; i += 1) {
      const lineEl = this.lyricsContainer.querySelector(`#lyrics-line-${i}`);
      if (lineEl) {
        this.lineElementCache.set(i, lineEl);
        lineEl._cachedSyllableElements = null;
      }
      const gapEl = this.lyricsContainer.querySelector(`#gap-${i}`);
      if (gapEl) {
        // Cache numeric timing values to avoid parseFloat on every frame
        gapEl._cachedStartTime = parseFloat(gapEl.getAttribute('data-start-time') || '0');
        gapEl._cachedEndTime = parseFloat(gapEl.getAttribute('data-end-time') || '0');
        this.gapElementCache.set(i, gapEl);
      }
    }
    this.lyricsContainer.querySelectorAll('.lyrics-word').forEach(wordElement => {
      const target = wordElement;
      target._cachedVirtualWordElements = undefined;
      target._cachedVirtualWordCharSpans = undefined;
      target._wordPreWipeKey = undefined;
    });
    this.lyricsContainer.querySelectorAll('.lyrics-syllable').forEach(syllable => {
      const target = syllable;
      target._cachedStartTime = undefined;
      target._cachedEndTime = undefined;
      target._cachedVocalTrack = undefined;
      target._cachedCharSpans = undefined;
    });
    // Rebuild cached line array for scroll/position queries
    const lineElements = this.lyricsContainer.querySelectorAll('.lyrics-line');
    this.cachedLineArray = Array.from(lineElements);
  }
  _getLineElement(index) {
    const cached = this.lineElementCache.get(index);
    if (cached) return cached;
    if (!this.lyricsContainer) return null;
    const el = this.lyricsContainer.querySelector(`#lyrics-line-${index}`);
    if (el) this.lineElementCache.set(index, el);
    return el;
  }
  _getGapElement(index) {
    const cached = this.gapElementCache.get(index);
    if (cached) return cached;
    if (!this.lyricsContainer) return null;
    const el = this.lyricsContainer.querySelector(`#gap-${index}`);
    if (el) this.gapElementCache.set(index, el);
    return el;
  }
  clearGapAnimations() {
    this.gapAnimations.forEach((motion, gap) => {
      motion.animations.forEach(animation => animation.cancel());
      gap.classList.remove('active', 'gap-collapsing', 'gap-exiting');
    });
    this.gapAnimations.clear();
  }
  _invalidateCaches() {
    this.finishLineRewind();
    this.pendingLayoutOffsets.clear();
    this.clearGapAnimations();
    this.cancelLineScrollAnimation();
    this.lyricsContainer?.querySelectorAll('.native-motion').forEach(char => AmLyrics.clearCharacterMotion(char));
    AmLyrics.motionWords = new WeakMap();
    AmLyrics.motionSyllables = new WeakMap();
    AmLyrics.motionParameters = new WeakMap();
    this.clearProgressiveBlurLine();
    this.cachedAllGaps = [];
    this.cachedIsUnsynced = false;
    this.cachedLineData = null;
    this.lineElementCache.clear();
    this.gapElementCache.clear();
    this.footerElement = undefined;
    this.cachedLineArray = [];
    this.preActiveLineElements = [];
    this.positionedLineElements = [];
    this.clearGapAnimations();
    this.activeGapLineElements = [];
    this.lastInstrumentalIndex = null;
    this.clearBackgroundExpandedLine();
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
  }
  _updateCachedIsUnsynced() {
    this.cachedIsUnsynced = this.lyrics && this.lyrics.length > 0 ? this.lyrics.every(l => l.timestamp === 0 && l.endtime === 0) : false;
  }
  static characterMotionMode(text, durationMs, background = false) {
    // Native constructor RVA 0x2f483c–0x2f48e0 and draw gate 0x2f662f.
    // 0x2f4080 detects Chinese/Japanese; Hangul is not part of that predicate.
    // Keep connected RTL scripts intact in the browser renderer.
    if (/[\u0590-\u08ff]/.test(text)) return 'none';
    const count = Array.from(text.trim()).length;
    if (!count) return 'none';
    if (/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/.test(text)) {
      return count > 1 ? 'rise' : 'none';
    }
    return !background && durationMs >= 1000 && count <= 7 ? 'emphasis' : 'none';
  }
  _ensureLineDataCache() {
    if (this.cachedLineData || !this.lyrics) return;
    this.cachedLineData = this.lyrics.map(line => {
      const wordGroups = [];
      let currentGroupBuffer = [];
      line.text.forEach((syllable, idx) => {
        currentGroupBuffer.push(syllable);
        const nextSyllable = line.text[idx + 1];
        const endsWithDelimiter = !nextSyllable || syllable.part === false || /\s$/.test(syllable.text) || nextSyllable && syllable.isBackground !== nextSyllable.isBackground;
        if (endsWithDelimiter) {
          wordGroups.push(currentGroupBuffer);
          currentGroupBuffer = [];
        }
      });
      if (currentGroupBuffer.length > 0) {
        wordGroups.push(currentGroupBuffer);
      }
      const groupGrowable = new Array(wordGroups.length).fill(false);
      const groupGlowing = new Array(wordGroups.length).fill(false);
      const groupCharRise = new Array(wordGroups.length).fill(false);
      const groupCharDrag = new Array(wordGroups.length).fill(false);
      const vwFullDuration = new Array(wordGroups.length).fill(0);
      const vwCharOffset = new Array(wordGroups.length).fill(0);
      const vwStartMs = new Array(wordGroups.length).fill(0);
      const vwEndMs = new Array(wordGroups.length).fill(0);
      let lineIsRTL = line.direction === 'rtl';
      let vwStart = 0;
      while (vwStart < wordGroups.length) {
        let vwEnd = vwStart;
        while (vwEnd < wordGroups.length - 1) {
          const grp = wordGroups[vwEnd];
          const lastText = grp[grp.length - 1].text;
          // Visible whitespace defines the word, not provider-specific part flags.
          if (/\s$/.test(lastText) || /^\s/.test(wordGroups[vwEnd + 1][0].text)) break;
          vwEnd += 1;
        }
        const combinedText = wordGroups.slice(vwStart, vwEnd + 1).flatMap(g => g.map(s => s.text)).join('').trim();
        const combinedStart = wordGroups[vwStart][0].timestamp;
        const lastGrp = wordGroups[vwEnd];
        const combinedEnd = lastGrp[lastGrp.length - 1].endtime;
        const combinedDuration = combinedEnd - combinedStart;
        const isRTL = /[\u0590-\u08ff]/.test(combinedText);
        if (isRTL) lineIsRTL = true;
        const isLineSynced = line.isWordSynced === false || line.text.some(s => s.lineSynced);
        const mode = isLineSynced ? 'none' : AmLyrics.characterMotionMode(combinedText, combinedDuration, line.background);
        const isGrowableVW = mode === 'emphasis';
        const isCharRiseVW = mode === 'rise';
        const isCharDragVW = false;
        const isGlowingVW = isGrowableVW;
        let charOff = 0;
        for (let gi = vwStart; gi <= vwEnd; gi += 1) {
          groupGrowable[gi] = isGrowableVW;
          groupGlowing[gi] = isGlowingVW;
          groupCharRise[gi] = isCharRiseVW;
          groupCharDrag[gi] = isCharDragVW;
          vwFullDuration[gi] = combinedDuration;
          vwCharOffset[gi] = charOff;
          vwStartMs[gi] = combinedStart;
          vwEndMs[gi] = combinedEnd;
          const grpText = wordGroups[gi].map(s => s.text).join('');
          charOff += Array.from(grpText.replace(/\s/g, '')).length;
        }
        vwStart = vwEnd + 1;
      }
      return {
        wordGroups,
        groupGrowable,
        groupGlowing,
        groupCharRise,
        groupCharDrag,
        vwFullDuration,
        vwCharOffset,
        vwStartMs,
        vwEndMs,
        lineIsRTL
      };
    });
  }
  _updateCharTimingData() {
    if (!this.shadowRoot) return;
    this._rebuildDomCache();
    const charTimedWords = Array.from(this.shadowRoot.querySelectorAll('.lyrics-word:has(.char)'));
    if (charTimedWords.length === 0) return;
    const wordsByVirtualId = new Map();
    charTimedWords.forEach((wordSpan, index) => {
      const virtualWordId = wordSpan.dataset.virtualWordId || `word-${index}`;
      const words = wordsByVirtualId.get(virtualWordId);
      if (words) {
        words.push(wordSpan);
      } else {
        wordsByVirtualId.set(virtualWordId, [wordSpan]);
      }
    });
    wordsByVirtualId.forEach(wordSpans => {
      const syllables = [];
      wordSpans.forEach(wordSpan => {
        const syllableWraps = wordSpan.querySelectorAll('.lyrics-syllable-wrap');
        syllableWraps.forEach(wrap => {
          const syl = wrap.querySelector('.lyrics-syllable');
          if (syl) syllables.push(syl);
        });
      });
      const charSpans = syllables.flatMap(syl => {
        const spans = Array.from(syl.querySelectorAll('.char'));
        const target = syl;
        target._cachedCharSpans = spans;
        return spans;
      });
      if (charSpans.length === 0) return;
      wordSpans.forEach(wordSpan => {
        const target = wordSpan;
        target._cachedVirtualWordElements = wordSpans;
        target._cachedVirtualWordCharSpans = charSpans;
      });
      syllables.forEach(syllable => {
        const spans = syllable._cachedCharSpans;
        if (!spans.length) return;
        // Computed width is untransformed and keeps fractional CSS pixels.
        // BoundingClientRect would include the currently running rise/scale.
        const widths = spans.map(span => parseFloat(getComputedStyle(span).width));
        const width = widths.reduce((total, value) => total + value, 0);
        if (!Number.isFinite(width) || width <= 0) return;
        let offset = 0;
        spans.forEach((span, index) => {
          span.style.setProperty('--word-wipe-width', `${width}px`);
          span.style.setProperty('--char-wipe-position', `${-offset}px`);
          offset += widths[index];
        });
      });
    });
  }
  static arraysEqual(a, b) {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }
  static isLineSyncedLine(line) {
    if (!line) return false;
    return line.isWordSynced === false || line.text.some(s => s.lineSynced);
  }
  getLineHighlightEndTime(index) {
    if (!this.lyrics) return 0;
    const line = this.lyrics[index];
    if (!line) return 0;
    const backgroundEnd = line.backgroundText?.reduce((latest, syllable) => Math.max(latest, syllable.endtime), line.timestamp);
    const rawEnd = Math.max(line.endtime, backgroundEnd ?? line.timestamp, line.timestamp);
    const nextLine = this.lyrics[index + 1];
    if (!nextLine || nextLine.timestamp <= line.timestamp) {
      return rawEnd > line.timestamp ? rawEnd + 200 : rawEnd;
    }
    if (rawEnd > line.timestamp) {
      if (nextLine.timestamp < rawEnd) {
        return rawEnd;
      }
      const gapToNext = nextLine.timestamp - rawEnd;
      if (gapToNext >= INSTRUMENTAL_THRESHOLD_MS) {
        return rawEnd;
      }
    }
    return nextLine.timestamp;
  }
  static getLineIndexFromElement(lineElement) {
    if (!lineElement) return null;
    const match = lineElement.id.match(/^lyrics-line-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }
  static easeOutExpo(progress) {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return 1 - 2 ** (-10 * progress);
  }
  static getCssTimeMs(element, propertyName, fallback) {
    const value = getComputedStyle(element).getPropertyValue(propertyName).trim();
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return value.endsWith('ms') ? parsed : parsed * 1000;
  }
  updateInstrumentalGap(gap, timeMs) {
    const gapStartTime = gap._cachedStartTime ?? parseFloat(gap.getAttribute('data-start-time') || '0');
    const gapEndTime = gap._cachedEndTime ?? parseFloat(gap.getAttribute('data-end-time') || '0');
    let exitLeadMs = this.gapExitDurationCache.get(gap);
    if (exitLeadMs === undefined) {
      exitLeadMs = AmLyrics.getCssTimeMs(gap, '--am-lyrics-instrumental-exit-duration', GAP_EXIT_LEAD_MS);
      this.gapExitDurationCache.set(gap, exitLeadMs);
    }
    let collapseLeadMs = this.gapCollapseDurationCache.get(gap);
    if (collapseLeadMs === undefined) {
      collapseLeadMs = AmLyrics.getCssTimeMs(gap, '--am-lyrics-instrumental-collapse-duration', GAP_COLLAPSE_LEAD_MS);
      this.gapCollapseDurationCache.set(gap, collapseLeadMs);
    }
    let dots = this.gapDotCache.get(gap);
    if (!dots) {
      dots = Array.from(gap.querySelectorAll('.lyrics-syllable'));
      this.gapDotCache.set(gap, dots);
    }
    const duration = Math.max(1, gapEndTime - gapStartTime);
    const elapsed = timeMs - gapStartTime;
    if (elapsed < 0 || elapsed >= duration + GAP_EXIT_TRAIL_MS) {
      const before = gap.classList.contains('active') ? this.captureLyricLayout() : null;
      this.gapAnimations.get(gap)?.animations.forEach(animation => animation.cancel());
      this.gapAnimations.delete(gap);
      gap.classList.remove('active', 'gap-collapsing', 'gap-exiting');
      const index = this.activeGapLineElements.indexOf(gap);
      if (index !== -1) this.activeGapLineElements.splice(index, 1);
      if (before) this.finishLyricLayout(before);
      return;
    }
    const remaining = duration - elapsed;
    const layoutBefore = gap.classList.contains('active') !== remaining > collapseLeadMs ? this.captureLyricLayout() : null;
    gap.classList.toggle('active', remaining > collapseLeadMs);
    gap.classList.toggle('gap-collapsing', remaining <= collapseLeadMs);
    gap.classList.toggle('gap-exiting', remaining <= collapseLeadMs + exitLeadMs);
    if (!this.activeGapLineElements.includes(gap)) this.activeGapLineElements.push(gap);
    if (layoutBefore) this.finishLyricLayout(layoutBefore);
    let motion = this.gapAnimations.get(gap);
    if (!motion) {
      const layer = gap.querySelector('.main-vocal-container');
      if (!layer) return;
      const exitStart = Math.max(GAP_ENTRY_SCALE_MS, duration - collapseLeadMs - exitLeadMs);
      const end = Math.min(duration, exitStart + exitLeadMs);
      const entryStart = Math.max(0, Math.min(elapsed, exitStart - GAP_ENTRY_SCALE_MS));
      // Dense samples only around the entrance and exit; the slow breath needs
      // far fewer. The browser interpolates all frames without playback ticks.
      const times = new Set([0, entryStart, entryStart + GAP_ENTRY_FADE_MS, entryStart + GAP_ENTRY_SCALE_MS, exitStart, end]);
      for (let t = entryStart + 25; t < entryStart + GAP_ENTRY_SCALE_MS; t += 25) times.add(t);
      for (let t = entryStart + GAP_ENTRY_SCALE_MS; t < exitStart; t += Math.max(200, exitStart / 1000)) times.add(t);
      for (let t = exitStart; t < end; t += 20) times.add(t);
      const frames = [...times].filter(t => t <= end).sort((a, b) => a - b).map(time => {
        const cycle = GAP_PULSE_DURATION_MS * 2;
        const phase = (time + GAP_PULSE_DURATION_MS - exitStart % cycle + cycle) % cycle;
        const mix = (1 - Math.cos(Math.PI * phase / GAP_PULSE_DURATION_MS)) / 2;
        let scale = (GAP_BREATH_MAX_SCALE + (GAP_BREATH_MIN_SCALE - GAP_BREATH_MAX_SCALE) * mix) * AmLyrics.easeOutExpo(AmLyrics.clamp((time - entryStart) / GAP_ENTRY_SCALE_MS, 0, 1));
        let opacity = AmLyrics.clamp((time - entryStart) / GAP_ENTRY_FADE_MS, 0, 1);
        if (time >= exitStart) {
          const progress = (time - exitStart) / Math.max(1, end - exitStart);
          const popping = progress <= GAP_EXIT_POP_PROGRESS;
          const phaseProgress = popping ? progress / GAP_EXIT_POP_PROGRESS : (progress - GAP_EXIT_POP_PROGRESS) / (1 - GAP_EXIT_POP_PROGRESS);
          const ease = phaseProgress * phaseProgress * (3 - 2 * phaseProgress);
          scale = popping ? GAP_BREATH_MIN_SCALE + (GAP_EXIT_POP_SCALE - GAP_BREATH_MIN_SCALE) * ease : GAP_EXIT_POP_SCALE * (1 - ease);
          opacity = popping ? 1 : 1 - ease;
        }
        return {
          offset: time / end,
          transform: `scale(${scale})`,
          opacity
        };
      });
      const animation = layer.animate(frames, {
        duration: end,
        fill: 'both'
      });
      const animations = [animation, ...dots.map((dot, index) => dot.animate([{
        opacity: 0.25
      }, {
        opacity: 1
      }], {
        duration: exitStart / 3,
        delay: index * exitStart / 3,
        fill: 'both'
      }))];
      animations.forEach(effect => {
        const timeline = effect;
        timeline.currentTime = elapsed;
      });
      motion = {
        animations,
        end
      };
      this.gapAnimations.set(gap, motion);
    } else if (Math.abs(Number(motion.animations[0].currentTime) - Math.min(elapsed, motion.end)) > 200) {
      motion.animations.forEach(animation => {
        const timeline = animation;
        timeline.currentTime = elapsed;
        if (animation.playState === 'finished' && elapsed < Number(animation.effect?.getComputedTiming().endTime)) animation.play();
      });
    }
  }
  clearPreActiveClasses(exceptLineIndex = null) {
    if (!this.lyricsContainer) return;
    const keptLines = [];
    for (const lineElement of this.preActiveLineElements) {
      const lineIndex = AmLyrics.getLineIndexFromElement(lineElement);
      if (lineIndex === exceptLineIndex) {
        keptLines.push(lineElement);
      } else {
        lineElement.classList.remove('pre-active');
        lineElement.classList.remove('progressive-unblur');
        lineElement.style.removeProperty('filter');
      }
    }
    this.preActiveLineElements = keptLines;
  }
  clearProgressiveBlurLine() {
    if (!this.progressiveBlurLine) return;
    this.progressiveBlurLine.classList.remove('progressive-unblur');
    this.progressiveBlurLine.style.removeProperty('filter');
    this.progressiveBlurLine = null;
  }
  captureLyricLayout() {
    const lines = this.cachedLineArray.length ? this.cachedLineArray : Array.from(this.lyricsContainer?.querySelectorAll('.lyrics-line') || []);
    const reference = Math.max(0, lines.indexOf(this.currentPrimaryActiveLine));
    return {
      tops: new Map(lines.slice(Math.max(0, reference - 20), reference + 21).map(line => [line, line.offsetTop])),
      scrollTop: this.lyricsContainer?.scrollTop || 0
    };
  }
  finishLyricLayout(before, deferScroll = false) {
    if (!this.lyricsContainer) return;
    const scrollCorrection = this.lyricsContainer.scrollTop - before.scrollTop;
    before.tops.forEach((top, line) => {
      const delta = top - line.offsetTop + scrollCorrection;
      if (Math.abs(delta) > 0.1) this.pendingLayoutOffsets.set(line, (this.pendingLayoutOffsets.get(line) || 0) + delta);
    });
    if (deferScroll || !this.pendingLayoutOffsets.size) return;
    const target = this.currentPrimaryActiveLine;
    const top = target && this.autoScroll && !this.isUserScrolling ? Math.max(0, target.offsetTop - this.getScrollPaddingTop()) : this.lyricsContainer.scrollTop;
    this.animateScrollYouLy(-top, false, undefined, target);
  }
  setBackgroundExpandedLine(lineElement, deferScroll = false) {
    const target = lineElement && !lineElement.classList.contains('lyrics-gap') && lineElement.querySelector('.background-vocal-container') ? lineElement : null;
    const changing = target && !this.backgroundExpandedLines.has(target) || [...this.backgroundExpandedLines].some(([line, timing]) => line !== target && !(this.currentTime >= timing.start && this.currentTime < timing.end));
    if (!changing) return false;
    const before = this.captureLyricLayout();
    this.backgroundExpandedLines.forEach((timing, line) => {
      // Keep the entire backing phrase through brief gaps and overlapping leads.
      // It must not prevent the incoming line's backing vocals from opening.
      if (line === target || this.currentTime >= timing.start && this.currentTime < timing.end) return;
      this.backgroundExpandedLines.delete(line);
      line.classList.remove('bg-expanded');
      const exitDuration = this.shouldReduceMotion ? 0 : AmLyrics.getCssTimeMs(line, '--am-lyrics-background-vocal-exit-duration', BACKGROUND_EXIT_DURATION_MS);
      line.style.setProperty('--background-vocal-exit-duration', `${exitDuration}ms`);
      line.classList.add('bg-collapsing');
      const timeoutId = window.setTimeout(() => {
        line.classList.remove('bg-collapsing');
        line.style.removeProperty('--background-vocal-exit-duration');
        this.backgroundCollapseTimeouts.delete(line);
      }, exitDuration);
      this.backgroundCollapseTimeouts.set(line, timeoutId);
    });
    if (!target || this.backgroundExpandedLines.has(target)) {
      this.finishLyricLayout(before, deferScroll);
      return true;
    }
    const timeoutId = this.backgroundCollapseTimeouts.get(target);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    this.backgroundCollapseTimeouts.delete(target);
    const notes = Array.from(target.querySelectorAll('.background-vocal-container .lyrics-syllable'));
    this.backgroundExpandedLines.set(target, {
      start: Math.min(...notes.map(note => Number(note.dataset.startTime))),
      end: Math.max(...notes.map(note => Number(note.dataset.endTime)))
    });
    target.classList.remove('bg-collapsing');
    target.style.removeProperty('--background-vocal-exit-duration');
    AmLyrics.scheduleBackgroundExpansion(target);
    this.finishLyricLayout(before, deferScroll);
    return true;
  }
  static scheduleBackgroundExpansion(target) {
    const wrap = target.querySelector('.background-vocal-wrap');
    if (!wrap) return;
    // Measure natural content, never the transitioning container or scaled bounds.
    // Padding is constant in every state, so reversals cannot accumulate spacing.
    target.style.setProperty('--am-lyrics-background-vocal-height', `${wrap.offsetHeight + 4}px`);
    target.classList.add('bg-expanded');
  }
  clearBackgroundExpandedLine() {
    for (const line of this.backgroundExpandedLines.keys()) {
      line.classList.remove('bg-expanded', 'bg-collapsing');
      line.style.removeProperty('--background-vocal-exit-duration');
    }
    for (const [line, timeoutId] of this.backgroundCollapseTimeouts) {
      clearTimeout(timeoutId);
      line.classList.remove('bg-collapsing');
      line.style.removeProperty('--background-vocal-exit-duration');
    }
    this.backgroundCollapseTimeouts.clear();
    this.backgroundExpandedLines.clear();
  }
  getPrimaryActiveLineIndex(activeIndices) {
    if (activeIndices.length === 0) return null;
    const groupStart = activeIndices[0];
    const groupEnd = activeIndices[activeIndices.length - 1];
    let candidateIndex = Math.max(groupStart, groupEnd - 2);
    const currentPrimaryIndex = AmLyrics.getLineIndexFromElement(this.currentPrimaryActiveLine);
    if (currentPrimaryIndex !== null && activeIndices.includes(currentPrimaryIndex)) {
      if (activeIndices.length <= 3) {
        candidateIndex = currentPrimaryIndex;
      } else if (candidateIndex < currentPrimaryIndex) {
        candidateIndex = currentPrimaryIndex;
      }
    }
    return candidateIndex;
  }
  getPrimaryScrollLineIndex(_activeIndices, time) {
    if (!this.lyrics || this.lyrics.length === 0) return null;
    // YouLyPlus-style: primary is simply the line at predictive time.
    const primaryIndex = this.getLineIndexAtTime(time, this.lastActiveIndex);
    if (primaryIndex === -1) return null;
    // Guard: if new primary is ahead of current but they share the same
    // end time, keep current to prevent bounce during overlaps.
    const currentPrimaryIndex = AmLyrics.getLineIndexFromElement(this.currentPrimaryActiveLine);
    if (currentPrimaryIndex !== null && primaryIndex > currentPrimaryIndex && this.lyrics[currentPrimaryIndex] && this.lyrics[primaryIndex] && this.lyrics[currentPrimaryIndex].endtime === this.lyrics[primaryIndex].endtime) {
      const activeCount = this.findActiveLineIndices(time).length;
      if (activeCount <= 3) {
        return currentPrimaryIndex;
      }
    }
    return primaryIndex;
  }
  getOverlapClusterForActiveIndices(activeIndices, time) {
    if (!this.lyrics || activeIndices.length === 0) return null;
    let start = activeIndices[0];
    while (start > 0 && this.lyrics[start - 1].endtime >= this.lyrics[start].timestamp) {
      start -= 1;
    }
    let end = start;
    let clusterEndTime = this.lyrics[start].endtime;
    while (end + 1 < this.lyrics.length && this.lyrics[end + 1].timestamp <= clusterEndTime) {
      end += 1;
      clusterEndTime = Math.max(clusterEndTime, this.lyrics[end].endtime);
    }
    let startedEnd = start;
    let startedEndTime = this.lyrics[start].endtime;
    for (let i = start; i <= end; i += 1) {
      if (this.lyrics[i].timestamp <= time) {
        startedEnd = i;
        startedEndTime = Math.max(startedEndTime, this.lyrics[i].endtime);
      } else {
        break;
      }
    }
    return {
      start,
      end,
      startedEnd,
      startedEndTime
    };
  }
  focusLine(lineElement, forceScroll = false, scrollDuration = undefined, skipScroll = false, preservePrimary = false) {
    const primaryChanged = lineElement !== this.currentPrimaryActiveLine;
    if (primaryChanged && !preservePrimary) {
      // .active is now managed solely by findActiveLineIndices (which uses
      // effectiveEndTimes).  Lines stay active until their extended end,
      // so we no longer need to remove .active here.
      this.lastPrimaryActiveLine = this.currentPrimaryActiveLine;
      if (this.lastPrimaryActiveLine) {
        this.lastPrimaryActiveLine.style.setProperty('--scroll-duration', `${scrollDuration ?? SCROLL_ANIMATION_DURATION_MS}ms`);
        this.lastPrimaryActiveLine.classList.add('scroll-exiting');
        const previousIndex = AmLyrics.getLineIndexFromElement(this.lastPrimaryActiveLine);
        if (previousIndex !== null && AmLyrics.isLineSyncedLine(this.lyrics?.[previousIndex])) {
          this.lastPrimaryActiveLine.classList.remove('active', 'pre-active');
          this.lastPrimaryActiveLine.removeAttribute('aria-current');
          AmLyrics.unfinishSyllables(this.lastPrimaryActiveLine);
        }
      }
      this.currentPrimaryActiveLine = lineElement;
      this.currentPrimaryActiveLine.classList.remove('scroll-exiting');
      const lineIndex = AmLyrics.getLineIndexFromElement(lineElement);
      if (lineIndex !== null) {
        this.lastActiveIndex = lineIndex;
      }
    }
    // Only update blur/opacity position classes when the primary line
    // actually changes (or on force scroll). Running this every tick
    // causes visual churn and upward glitches.
    if (primaryChanged || forceScroll) {
      this.updatePositionClasses(lineElement);
    }
    if (!skipScroll && (forceScroll || primaryChanged || preservePrimary) && this.autoScroll && !this.isUserScrolling && !this.isClickSeeking) {
      this.scrollToActiveLineYouLy(lineElement, forceScroll, scrollDuration);
    }
  }
  setUserScrolling(value) {
    this.isUserScrolling = value;
    if (value) {
      this.lyricsContainer?.classList.add('user-scrolling');
      this.clearProgressiveBlurLine();
    } else {
      this.lyricsContainer?.classList.remove('user-scrolling');
    }
  }
  handleUserScroll() {
    // Ignore programmatic scrolls and click-seek scrolls
    if (this.isProgrammaticScroll || this.isClickSeeking) {
      return;
    }
    // Mark that user is currently scrolling
    this.setUserScrolling(true);
    this.clearPastLineHighlights();
    // Clear any existing timeout
    if (this.userScrollTimeoutId) {
      clearTimeout(this.userScrollTimeoutId);
    }
    // Let native momentum settle before returning control to auto-scroll.
    this.userScrollTimeoutId = window.setTimeout(() => {
      this.setUserScrolling(false);
      this.userScrollTimeoutId = undefined;
      // Optionally scroll back to current active line when re-enabling auto-scroll
      if (this.activeLineIndices.length > 0) {
        this._handleActiveLineScroll([], true);
      } else {
        const currentGap = this.findInstrumentalGapAt(this.currentTime);
        if (currentGap) {
          this.scrollToInstrumental(currentGap.insertBeforeIndex, true);
        }
      }
    }, USER_SCROLL_RESUME_DELAY_MS);
  }
  clearPastLineHighlights() {
    if (!this.lyricsContainer) return;
    const lineElements = this.cachedLineArray.length ? this.cachedLineArray : Array.from(this.lyricsContainer.querySelectorAll('.lyrics-line:not(.lyrics-gap)'));
    for (const line of lineElements) {
      if (!line.classList.contains('active') && line.classList.contains('persist-highlight')) {
        AmLyrics.unfinishSyllables(line);
      }
    }
  }
  /**
   * Find the first (lowest-index) line whose raw time range contains `timeMs`.
   * Uses a stable forward scan so overlapping ranges always return the same
   * line, preventing primary-target jitter that causes scroll glitches.
   */
  getLineIndexAtTime(timeMs, startHintIndex = 0) {
    if (!this.lyrics || this.lyrics.length === 0) return -1;
    const len = this.lyrics.length;
    // 1. Check hint and immediate neighbours first (fast path)
    const hint = Math.max(0, Math.min(startHintIndex, len - 1));
    for (let i = hint; i < len; i += 1) {
      const line = this.lyrics[i];
      if (line.timestamp > timeMs) break;
      if (timeMs >= line.timestamp && timeMs < line.endtime) {
        return i;
      }
    }
    for (let i = hint - 1; i >= 0; i -= 1) {
      const line = this.lyrics[i];
      if (timeMs >= line.timestamp && timeMs < line.endtime) {
        return i;
      }
      if (line.endtime < timeMs) break;
    }
    // 2. Full forward scan — guaranteed deterministic for overlaps
    for (let i = 0; i < len; i += 1) {
      const line = this.lyrics[i];
      if (line.timestamp > timeMs) break;
      if (timeMs >= line.timestamp && timeMs < line.endtime) {
        return i;
      }
    }
    return -1;
  }
  findActiveLineIndices(time) {
    if (!this.lyrics || this.lyrics.length === 0) return [];
    const activeLines = [];
    for (let i = 0; i < this.lyrics.length; i += 1) {
      const line = this.lyrics[i];
      const highlightEndTime = this.getLineHighlightEndTime(i);
      if (line.timestamp > time) break;
      if (time >= line.timestamp && time < highlightEndTime) {
        activeLines.push(i);
      }
    }
    return activeLines;
  }
  findInstrumentalGapAt(time) {
    if (!this.lyrics || this.lyrics.length === 0) return null;
    // Start-of-song gap: from 0 to first line timestamp
    const first = this.lyrics[0];
    if (time >= 0 && time < first.timestamp) {
      const gapStart = 0;
      const gapEnd = first.timestamp;
      if (gapEnd - gapStart >= INSTRUMENTAL_THRESHOLD_MS) {
        return {
          insertBeforeIndex: 0,
          gapStart,
          gapEnd
        };
      }
      return null;
    }
    // Find consecutive pair (i, i+1) that bounds the current time
    for (let i = 0; i < this.lyrics.length - 1; i += 1) {
      const curr = this.lyrics[i];
      const next = this.lyrics[i + 1];
      const gapStart = curr.endtime;
      const gapEnd = next.timestamp;
      if (time > gapStart && time < gapEnd) {
        if (gapEnd - gapStart >= INSTRUMENTAL_THRESHOLD_MS) {
          return {
            insertBeforeIndex: i + 1,
            gapStart,
            gapEnd
          };
        }
        return null;
      }
    }
    return null;
  }
  /**
   * Find ALL instrumental gaps in the song, regardless of current time.
   * Used by the template to always render gap elements in the DOM.
   */
  findAllInstrumentalGaps() {
    if (this.cachedAllGaps.length > 0) return this.cachedAllGaps;
    if (!this.lyrics || this.lyrics.length === 0) return [];
    const gaps = [];
    // Start-of-song gap
    const first = this.lyrics[0];
    if (first.timestamp >= INSTRUMENTAL_THRESHOLD_MS) {
      gaps.push({
        insertBeforeIndex: 0,
        gapStart: 0,
        gapEnd: first.timestamp
      });
    }
    // Inter-line gaps
    for (let i = 0; i < this.lyrics.length - 1; i += 1) {
      const curr = this.lyrics[i];
      const next = this.lyrics[i + 1];
      const gapStart = curr.endtime;
      const gapEnd = next.timestamp;
      if (gapEnd - gapStart >= INSTRUMENTAL_THRESHOLD_MS) {
        gaps.push({
          insertBeforeIndex: i + 1,
          gapStart,
          gapEnd
        });
      }
    }
    this.cachedAllGaps = gaps;
    return gaps;
  }
  handleLineClick(line) {
    if (this.cachedIsUnsynced) return;
    // Reset all syllables to prevent highlighting conflicts during seek
    if (this.lyricsContainer) {
      const allLines = this.lyricsContainer.querySelectorAll('.lyrics-line');
      allLines.forEach(lineEl => {
        AmLyrics.resetSyllables(lineEl);
        // Remove scroll-animate class and properties to stop any scroll animations
        lineEl.classList.remove('scroll-animate', 'scroll-exiting');
        lineEl.style.removeProperty('--scroll-delta');
        lineEl.style.removeProperty('--lyrics-line-delay');
      });
      // Ensure container state is clean
      this.lyricsContainer.classList.remove('wheel-scrolling');
    }
    this.cancelLineScrollAnimation();
    // Clear scroll animation timeouts
    // Also clear user scroll timeout to prevent stale scrollToActiveLine
    if (this.userScrollTimeoutId) {
      clearTimeout(this.userScrollTimeoutId);
      this.userScrollTimeoutId = undefined;
    }
    this.setUserScrolling(false);
    // Reset active line tracking to prevent scroll fighting
    this.currentPrimaryActiveLine = null;
    this.lastPrimaryActiveLine = null;
    this.activeLineIds.clear();
    this.setBackgroundExpandedLine(null);
    // Find the clicked line element and scroll to it with forceScroll (like YouLyPlus)
    // Timestamps are already in milliseconds — match the data-start-time attribute directly
    const clickedLineElement = this.lyricsContainer?.querySelector(`.lyrics-line[data-start-time="${line.text[0]?.timestamp || 0}"]`);
    if (clickedLineElement && this.lyricsContainer) {
      // Update active line reference to the clicked line
      this.currentPrimaryActiveLine = clickedLineElement;
      // Reset currentScrollOffset to actual scroll position to prevent stale delta
      this.currentScrollOffset = -this.lyricsContainer.scrollTop;
      // Set click-seek cooldown to prevent updated() scroll from fighting
      this.isClickSeeking = true;
      if (this.clickSeekTimeout) clearTimeout(this.clickSeekTimeout);
      this.clickSeekTimeout = setTimeout(() => {
        this.isClickSeeking = false;
      }, 800);
      this.scrollToActiveLineYouLy(clickedLineElement, true);
      this.setBackgroundExpandedLine(clickedLineElement);
    }
    const event = new CustomEvent('line-click', {
      detail: {
        timestamp: line.timestamp
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
  static getBackgroundTextPlacement(line) {
    if (!line.backgroundText || line.backgroundText.length === 0 || line.text.length === 0) {
      return 'after'; // Default to after if no comparison is possible
    }
    // Compare the start times of the first syllables
    const mainTextStartTime = line.text[0].timestamp;
    const backgroundTextStartTime = line.backgroundText[0].timestamp;
    return backgroundTextStartTime < mainTextStartTime ? 'before' : 'after';
  }
  scrollToActiveLine() {
    if (!this.lyricsContainer || this.activeLineIndices.length === 0) {
      return;
    }
    // Scroll to the first active line
    const firstActiveLineIndex = Math.min(...this.activeLineIndices);
    const activeLineElement = this.lyricsContainer.querySelector(`.lyrics-line:nth-child(${firstActiveLineIndex + 1})`);
    if (activeLineElement) {
      const containerHeight = this.lyricsContainer.clientHeight;
      const lineTop = activeLineElement.offsetTop;
      const lineHeight = activeLineElement.clientHeight;
      // Check if the line has background text placed before the main text
      const hasBackgroundBefore = activeLineElement.querySelector('.background-text.before');
      // Calculate the offset to center the main text content, accounting for background text placement
      let offsetAdjustment = 0;
      if (hasBackgroundBefore) {
        const backgroundElement = hasBackgroundBefore;
        offsetAdjustment = backgroundElement.clientHeight / 2; // Adjust to focus on main content
      }
      const top = lineTop - containerHeight / 2 + lineHeight / 2 - offsetAdjustment;
      // Use requestAnimationFrame for smoother iOS performance
      requestAnimationFrame(() => {
        this.isProgrammaticScroll = true;
        this.lyricsContainer?.scrollTo({
          top,
          behavior: 'smooth'
        });
        // Reset the flag after a short delay to allow the scroll to complete
        setTimeout(() => {
          this.isProgrammaticScroll = false;
        }, 100);
      });
    }
  }
  scrollToInstrumental(insertBeforeIndex, forceScroll = false) {
    if (!this.lyricsContainer) return;
    // Find the gap element by ID instead of nth-child
    const gapTarget = this.lyricsContainer.querySelector(`#gap-${insertBeforeIndex}`);
    if (gapTarget) {
      // Use same scroll position as lyrics (scroll-padding-top from top), not center
      // This matches YouLyPlus behavior where gaps don't scroll to a different position
      const paddingTop = this.getScrollPaddingTop();
      const targetTranslateY = paddingTop - gapTarget.offsetTop;
      this.isProgrammaticScroll = true;
      this.clearPastLineHighlights();
      this.animateScrollYouLy(targetTranslateY, forceScroll, undefined, gapTarget);
      setTimeout(() => {
        this.isProgrammaticScroll = false;
      }, 250);
    }
  }
  // === YouLyPlus-style Animation Methods ===
  /**
   * Get the scroll padding top value from CSS variable
   */
  getScrollPaddingTop() {
    if (!this.lyricsContainer) return 0;
    const style = getComputedStyle(this.lyricsContainer);
    const paddingTopValue = style.getPropertyValue('--lyrics-scroll-padding-top') || '12%';
    let result;
    if (paddingTopValue.includes('%')) {
      result = this.lyricsContainer.clientHeight * (parseFloat(paddingTopValue) / 100);
    } else {
      result = parseFloat(paddingTopValue) || 0;
    }
    return result;
  }
  cancelLineScrollAnimation() {
    this.lineSprings.forEach((spring, line) => {
      spring.animation.cancel();
      line.style.removeProperty('will-change');
    });
    this.lineSprings.clear();
  }
  static sampleSpring(position, velocity, time, frequency, damping = 0.9 * frequency) {
    const omega = Math.sqrt(frequency * frequency - damping * damping);
    const decay = Math.exp(-damping * time);
    const cos = Math.cos(omega * time);
    const sin = Math.sin(omega * time);
    return {
      position: decay * (position * cos + (velocity + damping * position) / omega * sin),
      velocity: decay * (velocity * cos - (damping * velocity + frequency * frequency * position) / omega * sin)
    };
  }
  animateScrollYouLy(newTranslateY, _forceScroll, _scrollDuration, referenceElement = null) {
    if (!this.lyricsContainer) return;
    const parent = this.lyricsContainer;
    const currentTop = parent.scrollTop;
    const requestedDelta = -newTranslateY - currentTop;
    if (this.shouldReduceMotion || this.lineMotion === 'instant') {
      this.cancelLineScrollAnimation();
      parent.scrollTop = Math.max(0, -newTranslateY);
      this.currentScrollOffset = -parent.scrollTop;
      this.pendingLayoutOffsets.clear();
      return;
    }
    if (Math.abs(requestedDelta) < 0.5 && !this.pendingLayoutOffsets.size) return;
    const lines = Array.from(parent.querySelectorAll('.lyrics-line'));
    const reference = lines.indexOf(referenceElement || this.currentPrimaryActiveLine || lines[0]);
    // LyricsBlossom's published line spring: mass 1, stiffness 100,
    // damping 18. Predictive look-ahead is not a playback-speed multiplier.
    const frequency = 10;
    // Sample the analytic spring once. The compositor advances translation;
    // playback work, lyric painting and JS frame scheduling cannot hold it up.
    // Read all current poses before cancelling anything or changing scrollTop.
    const poses = lines.map((line, index) => {
      const previous = this.lineSprings.get(line);
      const age = previous ? Math.max(0, Number(previous.animation.currentTime || 0) / 1000 - previous.delay) : 0;
      const pose = previous ? AmLyrics.sampleSpring(previous.position, previous.velocity, age, previous.frequency) : {
        position: 0,
        velocity: 0
      };
      const steps = requestedDelta >= 0 ? index - reference : reference - index;
      // Restore the row cascade without restarting delays when backing layout
      // retargets a spring already in flight. Layout offsets still preserve pose.
      let delay = 0;
      if (this.lineMotion !== 'uniform') {
        delay = previous ? Math.max(0, previous.delay - Number(previous.animation.currentTime || 0) / 1000) : Math.max(0, Math.min(4, steps)) * 0.05;
      }
      return {
        line,
        index,
        position: pose.position + (this.pendingLayoutOffsets.get(line) || 0),
        velocity: pose.velocity,
        delay
      };
    });
    this.pendingLayoutOffsets.clear();
    this.cancelLineScrollAnimation();
    // Animated translation contributes to scrollHeight. Measure the real
    // range only after removing it, or retargeting near the bottom jumps.
    const target = AmLyrics.clamp(-newTranslateY, 0, Math.max(0, parent.scrollHeight - parent.clientHeight));
    const delta = target - currentTop;
    parent.scrollTop = target;
    this.currentScrollOffset = -target;
    poses.forEach(({
      line,
      index,
      position: previousPosition,
      velocity,
      delay
    }) => {
      const position = previousPosition + delta;
      const settlingVelocity = position * velocity > 0 ? 0 : Math.sign(velocity) * Math.min(Math.abs(velocity), Math.abs(position) * 10);
      if (Math.abs(index - reference) > 20 || Math.abs(position) < 0.1 && Math.abs(settlingVelocity) < 0.1) return;
      const duration = 1.2;
      const frames = Array.from({
        length: 97
      }, (_, frame) => {
        const offset = frame / 96;
        const y = frame === 96 ? 0 : AmLyrics.sampleSpring(position, settlingVelocity, duration * offset, frequency).position;
        return {
          offset,
          translate: `0 ${y}px`
        };
      });
      line.style.setProperty('will-change', 'translate');
      const animation = line.animate(frames, {
        duration: duration * 1000,
        delay: delay * 1000,
        fill: 'both',
        easing: 'linear'
      });
      this.lineSprings.set(line, {
        animation,
        position,
        velocity: settlingVelocity,
        delay,
        frequency
      });
      animation.onfinish = () => {
        if (this.lineSprings.get(line)?.animation !== animation) return;
        animation.cancel();
        line.style.removeProperty('will-change');
        this.lineSprings.delete(line);
      };
    });
  }
  /**
   * Update position classes for YouLyPlus-style opacity/blur gradients
   */
  updatePositionClasses(lineToScroll) {
    if (!this.lyricsContainer) return;
    const positionClasses = ['lyrics-activest', 'post-active-line', 'next-active-line', 'prev-1', 'prev-2', 'prev-3', 'prev-4', 'next-1', 'next-2', 'next-3', 'next-4'];
    // Remove old position classes from tracked elements
    for (const el of this.positionedLineElements) {
      el.classList.remove(...positionClasses);
    }
    this.positionedLineElements = [];
    // Add new position classes
    lineToScroll.classList.add('lyrics-activest');
    this.positionedLineElements.push(lineToScroll);
    if (this.cachedLineArray.length === 0) {
      this.cachedLineArray = Array.from(this.lyricsContainer.querySelectorAll('.lyrics-line'));
    }
    const lineElements = this.cachedLineArray;
    const scrollLineIndex = lineElements.indexOf(lineToScroll);
    if (scrollLineIndex === -1) return;
    for (let i = Math.max(0, scrollLineIndex - 4); i <= Math.min(lineElements.length - 1, scrollLineIndex + 4); i += 1) {
      const position = i - scrollLineIndex;
      if (position !== 0) {
        const element = lineElements[i];
        if (position === -1) element.classList.add('post-active-line');else if (position === 1) element.classList.add('next-active-line');else if (position < 0) element.classList.add(`prev-${Math.abs(position)}`);else element.classList.add(`next-${position}`);
        this.positionedLineElements.push(element);
      }
    }
  }
  /**
   * Scroll to active line with YouLyPlus-style animation
   */
  scrollToActiveLineYouLy(activeLine, forceScroll = false, scrollDuration = undefined) {
    if (!activeLine || !this.lyricsContainer) return;
    const paddingTop = this.getScrollPaddingTop();
    const targetTop = Math.max(0, activeLine.offsetTop - paddingTop);
    const targetTranslateY = -targetTop;
    // Skip if already at target position
    if (!forceScroll && !this.pendingLayoutOffsets.size && Math.abs(this.lyricsContainer.scrollTop - targetTop) < 1) {
      return;
    }
    // Skip scroll if near the bottom of content and we aren't trying to scroll back up
    if (!forceScroll && !this.pendingLayoutOffsets.size && !activeLine.classList.contains('lyrics-footer')) {
      const parent = this.lyricsContainer;
      const atBottom = parent.scrollTop + parent.clientHeight >= parent.scrollHeight - 50;
      if (atBottom && targetTop > parent.scrollTop - 50) {
        return;
      }
    }
    this.lyricsContainer.classList.remove('not-focused', 'user-scrolling');
    this.isProgrammaticScroll = true;
    this.setUserScrolling(false);
    if (this.userScrollTimeoutId) {
      clearTimeout(this.userScrollTimeoutId);
      this.userScrollTimeoutId = undefined;
    }
    this.clearPastLineHighlights();
    const duration = scrollDuration ?? SCROLL_ANIMATION_DURATION_MS;
    setTimeout(() => {
      this.isProgrammaticScroll = false;
    }, duration + 160);
    this.animateScrollYouLy(targetTranslateY, forceScroll, scrollDuration, activeLine);
  }
  /**
   * Update syllable highlight animation - apply CSS wipe animation
   */
  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  static getVisibleCharacterCount(element) {
    const attrLength = parseFloat(element.getAttribute('data-word-length') || '');
    if (Number.isFinite(attrLength) && attrLength > 0) return attrLength;
    return (element.textContent || '').replace(/\s/g, '').length;
  }
  static getLongWordWipeScale(charCount) {
    if (charCount <= 6) return 1;
    return 1 + AmLyrics.clamp((charCount - 6) / 10, 0, 1) * LONG_WORD_WIPE_EXTRA_RATIO;
  }
  static applyWipeShape(element, charCount) {
    const extra = AmLyrics.clamp((charCount - 6) / 10, 0, 1) * LONG_WORD_WIPE_EXTRA_EM;
    const width = BASE_WIPE_GRADIENT_EM + extra;
    element.style.setProperty('--wipe-gradient-width', `${width.toFixed(3)}em`);
    element.style.setProperty('--wipe-gradient-half', `${(width / 2).toFixed(3)}em`);
  }
  static ensureWordWipeGeometry(charSpans, charCount) {
    if (charSpans.length === 0) return;
    const approxWidthCh = Math.max(1, charCount || charSpans.length);
    charSpans.forEach((span, index) => {
      if (!span.style.getPropertyValue('--word-wipe-width')) {
        span.style.setProperty('--word-wipe-width', `${approxWidthCh}ch`);
      }
      if (!span.style.getPropertyValue('--char-wipe-position')) {
        const startPct = index / Math.max(1, charSpans.length);
        span.style.setProperty('--char-wipe-position', `${-(AmLyrics.clamp(startPct, 0, 1) * approxWidthCh)}ch`);
      }
    });
  }
  static clearPreHighlight(syllable) {
    const target = syllable;
    target.classList.remove('pre-highlight');
    target.style.removeProperty('--pre-wipe-duration');
    target.style.removeProperty('--pre-wipe-delay');
    target.style.animation = '';
    target.querySelectorAll('.pre-wipe-lead').forEach(element => AmLyrics.clearPreWipeLead(element));
    AmLyrics.getCachedVirtualWordElements(AmLyrics.getWordElementForSyllable(syllable)).forEach(element => {
      const wordTarget = element;
      wordTarget._wordPreWipeKey = undefined;
    });
  }
  static clearPreWipeLead(element) {
    element.classList.remove('pre-wipe-lead');
    element.style.removeProperty('--pre-wipe-duration');
    element.style.removeProperty('--pre-wipe-delay');
  }
  static hasTextBoundaryAfter(syllable) {
    return /\s$/.test(syllable.textContent || '');
  }
  static getSyllableWordIndex(syllable) {
    const wordElement = AmLyrics.getWordElementForSyllable(syllable);
    const virtualWordId = wordElement?.dataset.virtualWordId;
    if (virtualWordId) {
      return `virtual:${virtualWordId}`;
    }
    const virtualWordStart = wordElement?.dataset.virtualWordStart;
    const virtualWordEnd = wordElement?.dataset.virtualWordEnd;
    if (virtualWordStart || virtualWordEnd) {
      return `virtual:${virtualWordStart || ''}:${virtualWordEnd || ''}`;
    }
    return syllable.getAttribute('data-word-index') || syllable.getAttribute('data-syllable-index') || '';
  }
  static getNextWordSyllable(syllables, index) {
    const current = syllables[index];
    const currentWordIndex = AmLyrics.getSyllableWordIndex(current);
    const previousSyllable = current;
    const currentVocalTrack = AmLyrics.getVocalTrack(current);
    for (let i = index + 1; i < syllables.length; i += 1) {
      const candidate = syllables[i];
      if (AmLyrics.getVocalTrack(candidate) !== currentVocalTrack) {
        return null;
      }
      if (candidate.classList.contains('transliteration')) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const candidateWordIndex = AmLyrics.getSyllableWordIndex(candidate);
      if (candidateWordIndex === currentWordIndex || !AmLyrics.hasTextBoundaryAfter(previousSyllable)) {
        return null;
      }
      return candidate;
    }
    return null;
  }
  static getPreviousNonTransliterationSyllable(syllables, index) {
    const currentVocalTrack = AmLyrics.getVocalTrack(syllables[index]);
    for (let i = index - 1; i >= 0; i -= 1) {
      const candidate = syllables[i];
      if (AmLyrics.getVocalTrack(candidate) !== currentVocalTrack) {
        return null;
      }
      if (!candidate.classList.contains('transliteration')) {
        return candidate;
      }
    }
    return null;
  }
  static getVocalTrack(syllable) {
    const target = syllable;
    if (target._cachedVocalTrack === undefined) {
      target._cachedVocalTrack = syllable.closest('.main-vocal-container, .background-vocal-container');
    }
    return target._cachedVocalTrack;
  }
  static getRenderedWordSyllables(syllable) {
    const wordElement = AmLyrics.getWordElementForSyllable(syllable);
    const wordElements = AmLyrics.getCachedVirtualWordElements(wordElement);
    const wordSyllables = wordElements.flatMap(element => Array.from(element.querySelectorAll('.lyrics-syllable')));
    return wordSyllables.filter(wordSyllable => !wordSyllable.classList.contains('transliteration'));
  }
  static getWordElementForSyllable(syllable) {
    return syllable.parentElement?.parentElement;
  }
  static getWordPreWipeKey(syllable) {
    const wordElement = AmLyrics.getWordElementForSyllable(syllable);
    return wordElement?.dataset.virtualWordId || `${syllable.getAttribute('data-start-time') || ''}:${AmLyrics.getSyllableWordIndex(syllable)}`;
  }
  static isPreWipeArmed(syllable) {
    const wordElement = AmLyrics.getWordElementForSyllable(syllable);
    const target = wordElement;
    return Boolean(target?._wordPreWipeKey === AmLyrics.getWordPreWipeKey(syllable));
  }
  static applyWordPreWipe(nextSyllable, wordSyllables, currentTimeMs, preWipeStartMs, preWipeDurationMs) {
    if (AmLyrics.isPreWipeArmed(nextSyllable)) return;
    const wordElement = AmLyrics.getWordElementForSyllable(nextSyllable);
    const wordElements = AmLyrics.getCachedVirtualWordElements(wordElement);
    const isCharacterRiseWord = wordElements.some(element => element.classList.contains('char-rise'));
    const charSpans = AmLyrics.getCachedVirtualWordCharSpans(wordElement, []);
    const elapsedPreWipe = currentTimeMs - preWipeStartMs;
    const charCount = charSpans.length || wordSyllables.reduce((total, wordSyllable) => total + (wordSyllable.textContent || '').replace(/\s/g, '').length, 0) || (nextSyllable.textContent || '').replace(/\s/g, '').length;
    AmLyrics.ensureWordWipeGeometry(charSpans, charCount);
    const leadChar = charSpans[0];
    const leadCharSyllable = leadChar?.closest('.lyrics-syllable');
    const preWipeSyllable = leadCharSyllable || wordSyllables[0] || nextSyllable;
    AmLyrics.applyWipeShape(preWipeSyllable, charCount);
    preWipeSyllable.style.setProperty('--pre-wipe-duration', `${preWipeDurationMs}ms`);
    preWipeSyllable.style.setProperty('--pre-wipe-delay', `${-elapsedPreWipe}ms`);
    preWipeSyllable.classList.add('pre-highlight');
    // Character-animated words still need a single word-leading gradient.
    // Giving every glyph this state creates one gradient per character and
    // makes the whole word enter the pre-wipe continuation simultaneously.
    if (leadChar && !isCharacterRiseWord) {
      AmLyrics.applyWipeShape(leadChar, charCount);
      leadChar.style.setProperty('--pre-wipe-duration', `${preWipeDurationMs}ms`);
      leadChar.style.setProperty('--pre-wipe-delay', `${-elapsedPreWipe}ms`);
      leadChar.classList.add('pre-wipe-lead');
    }
    wordElements.forEach(element => {
      const target = element;
      target._wordPreWipeKey = AmLyrics.getWordPreWipeKey(nextSyllable);
    });
  }
  static getWordPreWipeDuration(syllable, wordSyllables = AmLyrics.getRenderedWordSyllables(syllable)) {
    const renderedSyllables = wordSyllables.length > 0 ? wordSyllables : [syllable];
    const wordElement = AmLyrics.getWordElementForSyllable(syllable);
    const charSpans = AmLyrics.getCachedVirtualWordCharSpans(wordElement, []);
    // The shared character sweep starts transparent at the segment's timestamp.
    // A separate lead-glyph pre-wipe would flash and then restart that edge.
    if (charSpans.length > 0) return 0;
    const charCount = charSpans.length || renderedSyllables.reduce((total, wordSyllable) => total + (wordSyllable.textContent || '').replace(/\s/g, '').length, 0);
    if (charCount <= 0) return 0;
    return AmLyrics.clamp(64 + charCount * 9, NEXT_WORD_PRE_WIPE_MIN_DURATION_MS, NEXT_WORD_PRE_WIPE_MAX_DURATION_MS);
  }
  static maybePreWipeNextWord(syllables, index, currentTimeMs, currentEndTimeMs) {
    const syllable = syllables[index];
    if (syllable.classList.contains('line-synced') || syllable.classList.contains('transliteration') || syllable.closest('.lyrics-gap')) {
      return;
    }
    const currentWordReady = syllable.classList.contains('finished') || currentTimeMs >= currentEndTimeMs - WORD_PRE_WIPE_HANDOFF_LEAD_MS;
    if (!currentWordReady) return;
    const nextSyllable = AmLyrics.getNextWordSyllable(syllables, index);
    if (!nextSyllable || nextSyllable.classList.contains('line-synced') || nextSyllable.classList.contains('transliteration') || nextSyllable.closest('.lyrics-gap') || nextSyllable.classList.contains('highlight') || nextSyllable.classList.contains('finished')) {
      return;
    }
    const nextStartTimeMs = nextSyllable._cachedStartTime;
    if (!Number.isFinite(nextStartTimeMs)) return;
    const gapMs = nextStartTimeMs - currentEndTimeMs;
    if (gapMs > NEXT_WORD_PRE_WIPE_MAX_GAP_MS || gapMs < 0) {
      return;
    }
    const nextWordSyllables = AmLyrics.getRenderedWordSyllables(nextSyllable);
    const preWipeSyllables = nextWordSyllables.length > 0 ? nextWordSyllables : [nextSyllable];
    const preWipeDuration = AmLyrics.getWordPreWipeDuration(nextSyllable, preWipeSyllables);
    if (preWipeDuration <= 0) return;
    const preWipeStart = Math.max(nextStartTimeMs - preWipeDuration, currentEndTimeMs - WORD_PRE_WIPE_HANDOFF_LEAD_MS);
    if (currentTimeMs < preWipeStart || currentTimeMs >= nextStartTimeMs) {
      return;
    }
    if (AmLyrics.isPreWipeArmed(nextSyllable)) return;
    const effectivePreWipeDuration = nextStartTimeMs - preWipeStart;
    AmLyrics.applyWordPreWipe(nextSyllable, preWipeSyllables, currentTimeMs, preWipeStart, effectivePreWipeDuration);
  }
  static getCachedCharSpans(element) {
    const cacheTarget = element;
    if (!cacheTarget._cachedCharSpans) {
      cacheTarget._cachedCharSpans = Array.from(element.querySelectorAll('span.char'));
    }
    return cacheTarget._cachedCharSpans;
  }
  static getCachedVirtualWordElements(wordElement) {
    if (!wordElement) return [];
    const cacheTarget = wordElement;
    if (cacheTarget._cachedVirtualWordElements) {
      return cacheTarget._cachedVirtualWordElements;
    }
    const {
      virtualWordId
    } = wordElement.dataset;
    let wordElements = [wordElement];
    if (virtualWordId && wordElement.parentElement) {
      wordElements = Array.from(wordElement.parentElement.querySelectorAll('.lyrics-word')).filter(el => el.dataset.virtualWordId === virtualWordId);
    }
    wordElements.forEach(element => {
      const target = element;
      target._cachedVirtualWordElements = wordElements;
    });
    return wordElements;
  }
  static getCachedVirtualWordCharSpans(wordElement, fallbackCharSpans) {
    if (!wordElement) return fallbackCharSpans;
    const cacheTarget = wordElement;
    if (cacheTarget._cachedVirtualWordCharSpans) {
      return cacheTarget._cachedVirtualWordCharSpans;
    }
    const wordElements = AmLyrics.getCachedVirtualWordElements(wordElement);
    const charSpans = wordElements.flatMap(word => Array.from(word.querySelectorAll('span.char')));
    const result = charSpans.length > 0 ? charSpans : fallbackCharSpans;
    wordElements.forEach(element => {
      const target = element;
      target._cachedVirtualWordCharSpans = result;
    });
    return result;
  }
  static updateSyllableAnimation(syllable, elapsedTimeMs = 0) {
    if (syllable.classList.contains('highlight')) return;
    const {
      classList
    } = syllable;
    const hadPreHighlight = classList.contains('pre-highlight');
    const isRTL = classList.contains('rtl-text');
    const charSpans = AmLyrics.getCachedCharSpans(syllable);
    const isFirstSyllable = syllable.getAttribute('data-syllable-index') === '0';
    const isFirstInContainer = isFirstSyllable; // Simplified
    const isGap = syllable.closest('.lyrics-gap') !== null;
    // Get duration from data attribute
    const syllableDurationMs = parseFloat(syllable.getAttribute('data-duration') || '0') || 300;
    const charAnimationsMap = new Map();
    if (charSpans.length > 0) {
      // Every glyph receives the same clock and moving edge. Only its fixed
      // sampling offset differs. Keep explicit syllable timing for joined words.
      AmLyrics.applyWipeShape(syllable, charSpans.length);
      AmLyrics.ensureWordWipeGeometry(charSpans, charSpans.length);
      const animation = `char-word-wipe ${syllableDurationMs}ms linear ${-elapsedTimeMs}ms both`;
      charSpans.forEach(span => {
        AmLyrics.applyWipeShape(span, charSpans.length);
        charAnimationsMap.set(span, animation);
      });
    } else {
      // Syllable-level wipe for regular (non-growable) words without chars
      const wipeRatio = parseFloat(syllable.getAttribute('data-wipe-ratio') || '1');
      const wipeCharCount = AmLyrics.getVisibleCharacterCount(syllable);
      const wipeScale = AmLyrics.getLongWordWipeScale(wipeCharCount);
      const nominalVisualDuration = syllableDurationMs * wipeRatio * wipeScale;
      const visualDuration = Math.min(syllableDurationMs, nominalVisualDuration);
      AmLyrics.applyWipeShape(syllable, wipeCharCount);
      let wipeAnimation = 'wipe';
      if (hadPreHighlight) {
        wipeAnimation = isRTL ? 'wipe-from-pre-rtl' : 'wipe-from-pre';
      } else if (isFirstInContainer) {
        wipeAnimation = isRTL ? 'start-wipe-rtl' : 'start-wipe';
      } else {
        wipeAnimation = isRTL ? 'wipe-rtl' : 'wipe';
      }
      if (syllable.classList.contains('line-synced')) return;
      const currentWipeAnimation = isGap ? 'fade-gap' : wipeAnimation;
      // eslint-disable-next-line no-param-reassign
      syllable.style.animation = `${currentWipeAnimation} ${visualDuration}ms ${isGap ? 'ease-out' : 'linear'} ${-elapsedTimeMs}ms forwards`;
    }
    AmLyrics.getCachedVirtualWordElements(AmLyrics.getWordElementForSyllable(syllable)).forEach(element => {
      const target = element;
      target._wordPreWipeKey = undefined;
    });
    classList.remove('pre-highlight');
    classList.add('highlight');
    charSpans.forEach(span => AmLyrics.clearPreWipeLead(span));
    // Apply keyframe variables before assigning animation strings so the
    // first painted frame never uses fallback transform values.
    for (const [span, animationString] of charAnimationsMap.entries()) {
      span.style.removeProperty('background-color');
      span.style.animation = animationString;
    }
  }
  /**
   * Reset syllable animation state
   */
  static resetSyllable(syllable) {
    if (!syllable) return;
    // eslint-disable-next-line no-param-reassign
    syllable.style.animation = '';
    syllable.style.removeProperty('--pre-wipe-duration');
    syllable.style.removeProperty('--pre-wipe-delay');
    // Force background to secondary and disable transition to prevent lingering white
    // eslint-disable-next-line no-param-reassign
    syllable.style.transition = 'none';
    // eslint-disable-next-line no-param-reassign
    syllable.style.backgroundColor = 'var(--lyplus-text-secondary)';
    // Reset character animations — disable transition so finished chars don't slowly fade
    const charSpans = syllable.querySelectorAll('span.char');
    for (let i = 0; i < charSpans.length; i += 1) {
      const el = charSpans[i];
      el.style.animation = '';
      AmLyrics.clearCharacterMotion(el);
      el.style.transition = 'none';
      el.style.backgroundColor = 'var(--lyplus-text-secondary)';
      AmLyrics.clearPreWipeLead(el);
    }
    // Immediately remove all state classes
    syllable.classList.remove('highlight', 'finished', 'pre-highlight', 'cleanup');
  }
  static resetWordAnimationState(line) {
    const wordElements = line.querySelectorAll('.lyrics-word');
    wordElements.forEach(wordElement => {
      wordElement.classList.remove('word-started');
      const target = wordElement;
      target._wordPreWipeKey = undefined;
    });
  }
  /**
   * Reset all syllables in a line — batches deferred cleanup into a single rAF
   */
  static resetSyllables(line) {
    if (!line) return;
    line.classList.remove('persist-highlight');
    AmLyrics.resetWordAnimationState(line);
    // eslint-disable-next-line no-param-reassign
    line._cachedSyllableElements = null;
    const syllables = line.getElementsByClassName('lyrics-syllable');
    for (let i = 0; i < syllables.length; i += 1) {
      AmLyrics.resetSyllable(syllables[i]);
    }
    // Batch deferred style cleanup into a single rAF for all syllables in the line
    requestAnimationFrame(() => {
      for (let i = 0; i < syllables.length; i += 1) {
        const syllable = syllables[i];
        syllable.style.removeProperty('background-color');
        syllable.style.removeProperty('transition');
        const chars = syllable.querySelectorAll('span.char');
        for (let j = 0; j < chars.length; j += 1) {
          const el = chars[j];
          el.style.removeProperty('background-color');
          el.style.removeProperty('transition');
          el.style.removeProperty('will-change');
        }
      }
    });
  }
  /**
   * Gentle reset for normal playback: remove highlight/finished classes
   * without forcing inline styles. Lets CSS transition fade syllables
   * back to secondary colour smoothly.
   */
  static unfinishSyllables(line) {
    if (!line) return;
    line.classList.remove('persist-highlight');
    AmLyrics.resetWordAnimationState(line);
    const syllables = line.getElementsByClassName('lyrics-syllable');
    for (let i = 0; i < syllables.length; i += 1) {
      const s = syllables[i];
      s.classList.remove('highlight', 'finished', 'pre-highlight', 'cleanup');
      s.style.animation = '';
      s.style.removeProperty('--pre-wipe-duration');
      s.style.removeProperty('--pre-wipe-delay');
      s.style.removeProperty('background-color');
      s.style.removeProperty('transition');
      const chars = s.querySelectorAll('span.char');
      for (let j = 0; j < chars.length; j += 1) {
        const el = chars[j];
        el.style.animation = '';
        AmLyrics.clearCharacterMotion(el);
        el.style.removeProperty('will-change');
        el.style.removeProperty('background-color');
        el.style.removeProperty('transition');
        el.style.removeProperty('filter');
        AmLyrics.clearPreWipeLead(el);
      }
    }
  }
  static finishSyllablesUpToTime(line, currentTimeMs) {
    if (!line) return;
    let hasFinishedSyllable = false;
    let syllables = line._cachedSyllableElements;
    if (!syllables) {
      syllables = Array.from(line.querySelectorAll('.lyrics-syllable'));
      for (let i = 0; i < syllables.length; i += 1) {
        const syllable = syllables[i];
        syllable._cachedStartTime = parseFloat(syllable.getAttribute('data-start-time') || '0');
        syllable._cachedEndTime = parseFloat(syllable.getAttribute('data-end-time') || '0');
      }
      // eslint-disable-next-line no-param-reassign
      line._cachedSyllableElements = syllables;
    }
    for (let i = 0; i < syllables.length; i += 1) {
      const syllable = syllables[i];
      const startTime = syllable._cachedStartTime;
      if (Number.isFinite(startTime) && currentTimeMs >= startTime) {
        const {
          classList
        } = syllable;
        if (!classList.contains('finished')) {
          if (!classList.contains('highlight')) {
            AmLyrics.updateSyllableAnimation(syllable, Math.max(0, currentTimeMs - startTime));
          }
          classList.add('finished');
        }
        hasFinishedSyllable = true;
        classList.remove('highlight');
        classList.remove('pre-highlight');
        classList.add('cleanup');
        syllable.style.animation = '';
        syllable.style.removeProperty('--pre-wipe-duration');
        syllable.style.removeProperty('--pre-wipe-delay');
        syllable.style.removeProperty('background-color');
        AmLyrics.applyWipeShape(syllable, AmLyrics.getVisibleCharacterCount(syllable));
        const chars = syllable.querySelectorAll('span.char');
        for (let ci = 0; ci < chars.length; ci += 1) {
          const charEl = chars[ci];
          charEl.style.animation = '';
          charEl.style.backgroundColor = 'var(--lyplus-text-primary)';
          AmLyrics.clearPreWipeLead(charEl);
        }
      }
    }
    if (hasFinishedSyllable) {
      line.classList.add('persist-highlight');
    } else {
      line.classList.remove('persist-highlight');
    }
  }
  static clearCharacterMotion(char) {
    const entry = AmLyrics.characterAnimations.get(char);
    if (!entry) return;
    entry.animation.cancel();
    AmLyrics.characterAnimations.delete(char);
    char.classList.remove('native-motion');
    char.removeAttribute('data-glow');
  }
  static updateCharacterMotion(line, timeMs) {
    // Timing VM RVA 0x34722d0, emphasis VM 0x34723b0; CJK rise spring
    // mass 1, stiffness 14, damping 7 in 0x2f4e46 / 0x2f510b.
    let syllables = AmLyrics.motionSyllables.get(line);
    if (!syllables) {
      const seen = new Set();
      syllables = Array.from(line.querySelectorAll('.lyrics-syllable.has-chars')).filter(syllable => {
        const word = AmLyrics.getWordElementForSyllable(syllable);
        // CJK has no reliable whitespace word boundaries. Keep each timed
        // segment's clock; only non-CJK split words share a motion clock.
        const key = word?.classList.contains('char-rise') ? syllable : AmLyrics.getCachedVirtualWordElements(word)[0] || syllable;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      AmLyrics.motionSyllables.set(line, syllables);
    }
    syllables.forEach(syllable => {
      let parameters = AmLyrics.motionParameters.get(syllable);
      if (!parameters) {
        const word = AmLyrics.getWordElementForSyllable(syllable);
        const cjk = word?.classList.contains('char-rise') ?? false;
        const localChars = AmLyrics.getCachedCharSpans(syllable);
        const chars = cjk ? localChars : AmLyrics.getCachedVirtualWordCharSpans(word, localChars);
        const start = Number(cjk ? syllable.dataset.startTime : word?.dataset.virtualWordStart ?? syllable.dataset.startTime);
        const end = Number(cjk ? syllable.dataset.endTime : word?.dataset.virtualWordEnd ?? syllable.dataset.endTime);
        parameters = {
          chars,
          duration: Math.max(0.001, (end - start) / 1000),
          start,
          cjk
        };
        AmLyrics.motionParameters.set(syllable, parameters);
      }
      const {
        chars,
        duration,
        start,
        cjk
      } = parameters;
      const count = chars.length;
      if (!count) return;
      const elapsed = timeMs - start;
      const factor = cjk ? 0.8 : 0.4;
      const delay = Math.min(duration / count * factor, factor);
      const hold = 2 * duration / count;
      const response = Math.min(3, duration);
      const emphasis = cjk ? 0 : AmLyrics.clamp(duration - 1, 0, 1);
      const glow = cjk ? 0 : 0.45 * AmLyrics.clamp((duration - 1) / 0.5, 0, 1);
      const spanDuration = Math.max(hold + response * 2, cjk ? 3 : 0);
      chars.forEach((char, index) => {
        if (elapsed < 0) {
          AmLyrics.clearCharacterMotion(char);
          return;
        }
        const startDelay = cjk ? index * Math.min(40, 160 / Math.max(1, count - 1), duration * 1000 / (count * 8)) : (index + 1) * delay * 1000;
        const end = spanDuration * 1000 + startDelay;
        const key = parameters;
        let entry = AmLyrics.characterAnimations.get(char);
        if (!entry || entry.key !== key) {
          AmLyrics.clearCharacterMotion(char);
          const frameKey = `${duration}:${count}:${index}:${cjk}`;
          let frames = AmLyrics.characterFrames.get(frameKey);
          if (!frames) {
            frames = Array.from({
              length: 61
            }, (_, frame) => {
              const time = spanDuration * frame / 60;
              let rise = cjk ? 1 - AmLyrics.sampleSpring(1, 0, time, Math.sqrt(14), 3.5).position : AmLyrics.springProgress(time, response);
              if (frame === 60) rise = 1;
              const envelope = frame === 60 ? 0 : AmLyrics.springProgress(time, response) * (1 - AmLyrics.springProgress(time - hold, response));
              const x = (index - (count - 1) / 2) * 0.5 * 0.1 * emphasis * envelope;
              const lift = 2.5 * emphasis * envelope;
              return {
                offset: frame / 60,
                transform: `translate(calc(${x}em * var(--am-lyrics-lift)), calc((var(--char-rise-y) * ${rise} - ${lift}px) * var(--am-lyrics-lift))) scale(${1 + 0.1 * emphasis * envelope})`
              };
            });
            if (AmLyrics.characterFrames.size >= 64) {
              AmLyrics.characterFrames.delete(AmLyrics.characterFrames.keys().next().value);
            }
            AmLyrics.characterFrames.set(frameKey, frames);
          }
          if (glow) {
            char.setAttribute('data-glyph', char.textContent || '');
            char.setAttribute('data-glow', '');
            char.style.setProperty('--char-glow-max', `${glow}`);
            char.style.setProperty('--char-glow-duration', `${spanDuration * 1000}ms`);
            char.style.setProperty('--char-glow-delay', `${startDelay - elapsed}ms`);
          }
          char.classList.add('native-motion');
          // Transform a separate wrapper. WebKit can expose rectangular clip
          // edges when the gradient-clipped glyph itself is transformed.
          const motionTarget = char.parentElement?.classList.contains('char-motion') ? char.parentElement : char;
          const animation = motionTarget.animate(frames, {
            duration: spanDuration * 1000,
            delay: startDelay,
            fill: 'both',
            easing: 'linear'
          });
          animation.currentTime = Math.min(elapsed, end);
          entry = {
            animation,
            start,
            end,
            key,
            glowEpoch: elapsed
          };
          AmLyrics.characterAnimations.set(char, entry);
        } else if (Math.abs(Number(entry.animation.currentTime) - Math.min(elapsed, entry.end)) > 200) {
          // Correct seeks/drift, not every playback tick: repeated currentTime
          // writes pin compositor motion to the host's timestamp frequency.
          entry.animation.currentTime = Math.min(elapsed, entry.end);
          if (glow) {
            for (const effect of char.getAnimations()) {
              if ('animationName' in effect && effect.animationName === 'char-glow') {
                effect.currentTime = elapsed - entry.glowEpoch;
                if (elapsed < entry.end) effect.play();
              }
            }
          }
          if (elapsed < entry.end && entry.animation.playState === 'finished') entry.animation.play();
        }
      });
    });
  }
  static springProgress(time, response) {
    if (time <= 0) return 0;
    // Unit-mass critically damped spring, omega = 2 pi / response.
    // Native constructor: RVA 0x1559b0. Exact step response, no frame integration.
    const phase = 2 * Math.PI * time / Math.max(0.001, response);
    return 1 - (1 + phase) * Math.exp(-phase);
  }
  static seekLineWipes(line, time) {
    line.getAnimations({
      subtree: true
    }).forEach(animation => {
      if (!('animationName' in animation) || !String(animation.animationName).includes('wipe')) return;
      const effect = animation.effect;
      const syllable = effect.target?.closest('.lyrics-syllable');
      if (!syllable) return;
      const elapsed = time - Number(syllable.dataset.startTime) + Number(effect.getTiming().delay);
      const end = Number(effect.getComputedTiming().endTime);
      const timeline = animation;
      timeline.currentTime = Math.min(elapsed, end);
      if (elapsed < end && animation.playState !== 'running') {
        animation.play();
        timeline.currentTime = elapsed;
      }
    });
  }
  static updateSyllablesForLine(line, currentTimeMs) {
    let words = AmLyrics.motionWords.get(line);
    if (!words) {
      words = Array.from(line.querySelectorAll('.lyrics-word[data-virtual-word-start]')).map(element => ({
        element,
        start: Number(element.dataset.virtualWordStart)
      }));
      AmLyrics.motionWords.set(line, words);
    }
    words.forEach(({
      element,
      start
    }) => element.classList.toggle('word-started', currentTimeMs >= start));
    AmLyrics.updateCharacterMotion(line, currentTimeMs);
    // DOM cache: avoid querySelectorAll on every frame
    let syllables = line._cachedSyllableElements;
    if (!syllables) {
      syllables = Array.from(line.querySelectorAll('.lyrics-syllable'));
      for (let i = 0; i < syllables.length; i += 1) {
        const syllable = syllables[i];
        syllable._cachedStartTime = parseFloat(syllable.getAttribute('data-start-time') || '0');
        syllable._cachedEndTime = parseFloat(syllable.getAttribute('data-end-time') || '0');
      }
      // eslint-disable-next-line no-param-reassign
      line._cachedSyllableElements = syllables;
    }
    for (let i = 0; i < syllables.length; i += 1) {
      const syllable = syllables[i];
      const startTime = syllable._cachedStartTime;
      const endTime = syllable._cachedEndTime;
      if (Number.isFinite(startTime) && Number.isFinite(endTime)) {
        const {
          classList
        } = syllable;
        const hasHighlight = classList.contains('highlight');
        const hasFinished = classList.contains('finished');
        const hasPreHighlight = classList.contains('pre-highlight');
        const hasActiveState = hasHighlight || hasFinished || hasPreHighlight;
        // Early exit check
        if (!(currentTimeMs < startTime - 1000 && !hasActiveState)) {
          let preHighlightReset = false;
          // Before the syllable starts, pre-highlight only belongs beside a
          // previous active word. Once the syllable starts, updateSyllableAnimation
          // consumes the class so the actual wipe can continue from the pre-wipe
          // pose instead of restarting from the beginning.
          if (hasPreHighlight && currentTimeMs < startTime) {
            const prevSyllable = AmLyrics.getPreviousNonTransliterationSyllable(syllables, i);
            const previousCarriesHighlight = prevSyllable?.classList.contains('highlight') || prevSyllable?.classList.contains('finished');
            if (!previousCarriesHighlight) {
              AmLyrics.clearPreHighlight(syllable);
              preHighlightReset = true;
            }
          }
          if (!preHighlightReset) {
            if (currentTimeMs >= startTime && currentTimeMs <= endTime) {
              // Currently active
              if (!hasHighlight) {
                AmLyrics.updateSyllableAnimation(syllable, currentTimeMs - startTime);
              }
              if (hasFinished) {
                classList.remove('finished');
              }
            } else if (currentTimeMs > endTime) {
              // Finished
              if (!hasFinished) {
                if (!hasHighlight) {
                  AmLyrics.updateSyllableAnimation(syllable, currentTimeMs - startTime);
                }
                classList.add('finished');
                // Keep the completed wipe state until user scroll resets it.
              }
            } else if (hasHighlight || hasFinished) {
              // Not yet started
              AmLyrics.resetSyllable(syllable);
            }
            AmLyrics.maybePreWipeNextWord(syllables, i, currentTimeMs, endTime);
          }
        }
      }
    }
  }
  generateLRC() {
    if (!this.lyrics) return '';
    let lrc = '';
    // Add metadata if available
    if (this.songTitle) lrc += `[ti:${this.songTitle}]\n`;
    if (this.songArtist) lrc += `[ar:${this.songArtist}]\n`;
    if (this.songAlbum) lrc += `[al:${this.songAlbum}]\n`;
    if (this.lyricsSource) lrc += `[re:${this.lyricsSource}]\n`;
    for (const line of this.lyrics) {
      if (line.text && line.text.length > 0) {
        const timestamp = AmLyrics.formatTimestampLRC(line.timestamp);
        // Construct line text from syllables
        const lineText = line.text.map(s => s.text).join('').trim();
        lrc += `[${timestamp}]${lineText}\n`;
      }
    }
    return lrc;
  }
  generatePlain() {
    if (!this.lyrics) return '';
    return this.lyrics.flatMap(line => {
      const main = line.text.map(syllable => syllable.text).join('').trim();
      const backing = (line.backgroundText || []).map(syllable => syllable.text).join('').trim();
      // eslint-disable-next-line no-nested-ternary
      const background = backing ? backing.startsWith('(') && backing.endsWith(')') ? backing : `(${backing})` : '';
      return (AmLyrics.getBackgroundTextPlacement(line) === 'before' ? [background, main] : [main, background]).filter(Boolean);
    }).join('\n');
  }
  generateTTML() {
    if (!this.lyrics) return '';
    // Basic TTML structure
    let ttml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    ttml += '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyrics">\n';
    ttml += '  <body>\n';
    let currentPart;
    for (let i = 0; i < this.lyrics.length; i += 1) {
      const line = this.lyrics[i];
      const part = line.songPart;
      // If part changed (or first line), start new div
      if (part !== currentPart || i === 0) {
        if (i > 0) {
          ttml += '    </div>\n';
        }
        currentPart = part;
        if (currentPart) {
          ttml += `    <div itunes:song-part="${currentPart}">\n`;
        } else {
          ttml += '    <div>\n';
        }
      }
      // For TTML, we can represent syllables as spans if word-synced
      const begin = AmLyrics.formatTimestampTTML(line.timestamp);
      const end = AmLyrics.formatTimestampTTML(line.endtime);
      ttml += `      <p begin="${begin}" end="${end}">\n`;
      for (const word of line.text) {
        const wBegin = AmLyrics.formatTimestampTTML(word.timestamp);
        const wEnd = AmLyrics.formatTimestampTTML(word.endtime);
        // Escape special characters in text
        const text = word.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        ttml += `        <span begin="${wBegin}" end="${wEnd}">${text}</span>\n`;
      }
      ttml += '      </p>\n';
    }
    if (this.lyrics.length > 0) {
      ttml += '    </div>\n';
    }
    ttml += '  </body>\n';
    ttml += '</tt>';
    return ttml;
  }
  static formatTimestampLRC(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor(ms % 1000 / 10);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  }
  static formatTimestampTTML(ms) {
    // TTML standard format: HH:MM:SS.mmm
    const totalSeconds = ms / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor(ms % 1000);
    const pad = (n, width = 2) => n.toString().padStart(width, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
  }
  downloadLyrics() {
    if (!this.lyrics || this.lyrics.length === 0) return;
    // Determine format: TTML if ANY line is word-synced, else LRC
    const isWordSynced = this.lyrics.some(l => l.isWordSynced !== false);
    let content = '';
    let extension = this.downloadFormat;
    if (extension === 'auto') {
      extension = isWordSynced ? 'ttml' : 'lrc';
    }
    let mimeType = '';
    if (extension === 'ttml') {
      const source = this.availableSources[this.currentSourceIndex];
      content = source?.source === this.lyricsSource && source.originalTTML || this.generateTTML();
      mimeType = 'application/xml';
    } else if (extension === 'plain') {
      content = this.generatePlain();
      extension = 'txt';
      mimeType = 'text/plain;charset=utf-8';
    } else {
      content = this.generateLRC();
      mimeType = 'text/plain';
    }
    if (!content) return;
    const blob = new Blob([content], {
      type: mimeType
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = this.songTitle ? `${this.songTitle}${this.songArtist ? ` - ${this.songArtist}` : ''}.${extension}` : `lyrics.${extension}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  render() {
    if (this.fontFamily) {
      this.style.fontFamily = this.fontFamily;
    }
    // Set both old internal CSS variables (for backward compatibility)
    // and new public CSS variables (which take precedence)
    this.style.setProperty('--highlight-color', this.highlightColor);
    const sourceLabel = this.lyricsSource ?? 'Unavailable';
    const isUnsynced = this.cachedIsUnsynced;
    const hasLeftAlignedLines = this.lyrics?.some(line => line.alignment !== 'end');
    const hasRightAlignedLines = this.lyrics?.some(line => line.alignment === 'end');
    const hasDuetLines = hasLeftAlignedLines && hasRightAlignedLines;
    const renderContent = () => {
      if (this.isLoading) {
        // Render stylized skeleton lines
        return b` <div class="skeleton-line"></div> <div class="skeleton-line"></div> <div class="skeleton-line"></div> <div class="skeleton-line"></div> <div class="skeleton-line"></div> <div class="skeleton-line"></div> <div class="skeleton-line"></div> `;
      }
      if (!this.lyrics || this.lyrics.length === 0) {
        return b`<div class="no-lyrics">No lyrics found.</div>`;
      }
      // Build a lookup map of ALL gaps so they are always in the DOM
      const allGaps = this.findAllInstrumentalGaps();
      const gapByIndex = new Map(allGaps.map(g => [g.insertBeforeIndex, g]));
      return this.lyrics.map((line, lineIndex) => {
        const lineId = `lyrics-line-${lineIndex}`;
        // Calculate line timing
        const lineStartTime = line.text[0]?.timestamp || 0;
        const lineEndTime = line.text[line.text.length - 1]?.endtime || 0;
        // Always render background vocals in the DOM so the syllable cache
        // includes them and the wipe effect applies correctly.
        const hasBackground = line.backgroundText && line.backgroundText.length > 0;
        const bgPlacement = hasBackground ? AmLyrics.getBackgroundTextPlacement(line) : 'after';
        const backingWords = [];
        const backing = line.backgroundText || [];
        for (let first = 0; first < backing.length;) {
          let last = first;
          while (last + 1 < backing.length && !/\s$/.test(backing[last].text) && !/^\s/.test(backing[last + 1].text)) last += 1;
          const word = {
            text: backing.slice(first, last + 1).map(syllable => syllable.text).join(''),
            start: backing[first].timestamp,
            end: backing[last].endtime
          };
          for (let index = first; index <= last; index += 1) backingWords[index] = word;
          first = last + 1;
        }
        const lineIsRTL = this.cachedLineData?.[lineIndex]?.lineIsRTL ?? false;
        // Create background vocals container (with romanization support)
        const backgroundVocalElement = hasBackground ? b`<p class="background-vocal-container background-${bgPlacement}"> <span class="background-vocal-wrap"> ${line.backgroundText.map((syllable, syllableIndex) => {
          const startTimeMs = syllable.timestamp;
          const endTimeMs = syllable.endtime;
          const durationMs = endTimeMs - startTimeMs;
          const bgRomanizedText = this.showRomanization && syllable.romanizedText && syllable.romanizedText.trim() !== syllable.text.trim() ? b`<span class="lyrics-syllable transliteration no-chars ${syllable.lineSynced ? 'line-synced' : ''}" data-start-time="${startTimeMs}" data-end-time="${endTimeMs}" data-duration="${durationMs}" data-syllable-index="0" data-wipe-ratio="1">${syllable.romanizedText}</span>` : '';
          const backingWord = backingWords[syllableIndex];
          const bgChars = !syllable.lineSynced && AmLyrics.characterMotionMode(backingWord.text, backingWord.end - backingWord.start, true) !== 'none' ? Array.from(syllable.text.replace(/\s/g, '')) : [];
          let bgCharIndex = 0;
          return b`<span class="lyrics-word${bgChars.length ? ' char-rise' : ''}" data-virtual-word-id="bg-${lineIndex}-${backingWord.start}" data-virtual-word-start="${backingWord.start}" data-virtual-word-end="${backingWord.end}"><span class="lyrics-syllable-wrap${bgRomanizedText ? ' has-transliteration' : ''}"><span class="lyrics-syllable${lineIsRTL ? ' rtl-text' : ''} ${bgChars.length ? 'has-chars' : 'no-chars'}${syllable.lineSynced ? ' line-synced' : ''}" data-start-time="${startTimeMs}" data-end-time="${endTimeMs}" data-duration="${durationMs}" data-syllable-index="0" data-word-index="${syllableIndex}" data-word-length="${syllable.text.replace(/\s/g, '').length}" data-wipe-ratio="1">${bgChars.length ? Array.from(syllable.text).map(char => {
            if (/\s/.test(char)) return char;
            const index = bgCharIndex;
            bgCharIndex += 1;
            return b`<span class="char-motion"><span class="char" data-syllable-char-index="${index}" data-wipe-start="${index / bgChars.length}" data-wipe-duration="${1 / bgChars.length}">${char}</span></span>`;
          }) : syllable.text}</span>${bgRomanizedText}</span></span>`;
        })} </span> </p>` : '';
        // Background vocals share the same line.translation and line.romanizedText
        // as the main vocal, so we intentionally do NOT render a separate
        // translation/romanization block for background — it would just duplicate
        // the main line's text.
        const lineData = this.cachedLineData?.[lineIndex];
        const wordGroups = lineData?.wordGroups ?? [];
        const groupGrowable = lineData?.groupGrowable ?? [];
        const groupGlowing = lineData?.groupGlowing ?? [];
        const groupCharRise = lineData?.groupCharRise ?? [];
        const groupCharDrag = lineData?.groupCharDrag ?? [];
        const vwFullDuration = lineData?.vwFullDuration ?? [];
        const vwCharOffset = lineData?.vwCharOffset ?? [];
        const vwStartMs = lineData?.vwStartMs ?? [];
        const vwEndMs = lineData?.vwEndMs ?? [];
        const mainVocalElement = b`<p class="main-vocal-container ${lineIsRTL ? 'rtl-text' : ''}"> ${wordGroups.map((group, groupIdx) => {
          const isGrowable = groupGrowable[groupIdx];
          const isGlowing = groupGlowing[groupIdx];
          const isCharRise = groupCharRise[groupIdx];
          const isCharDrag = groupCharDrag[groupIdx];
          const isAnimatedByChar = isGrowable || isCharRise || isCharDrag;
          const groupLineSynced = line.isWordSynced === false || group.some(s => s.lineSynced);
          const wordDuration = isAnimatedByChar ? vwFullDuration[groupIdx] : 0;
          const groupCharOffset = isAnimatedByChar ? vwCharOffset[groupIdx] : 0;
          const virtualWordId = `${lineIndex}:${vwStartMs[groupIdx]}:${vwEndMs[groupIdx]}`;
          const virtualWordStart = vwStartMs[groupIdx];
          const virtualWordEnd = vwEndMs[groupIdx];
          let sylCharAccumulator = 0;
          const groupText = group.map(s => s.text).join('');
          const visibleWordLength = groupText.replace(/\s/g, '').length;
          const shouldAllowBreak = groupText.trim().length >= 16 || /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(groupText);
          // Calculate dynamic rise duration based on the audio duration of the word
          const wordStartTimeMs = group[0].timestamp;
          const wordEndTimeMs = group[group.length - 1].endtime;
          const actualDurationMs = wordEndTimeMs - wordStartTimeMs;
          // Base float is 0.8s, plus a portion of the audio duration, capped between 1.0s and 2.5s
          const riseDuration = Math.max(1.2, Math.min(2.5, 1.2 + actualDurationMs / 1000 * 0.6));
          return b`<span class="lyrics-word${isGrowable ? ' growable' : ''}${isCharRise ? ' char-rise' : ''}${isCharDrag ? ' char-drag' : ''}${isGlowing ? ' glowing' : ''}${shouldAllowBreak ? ' allow-break' : ''}" data-virtual-word-id="${virtualWordId}" data-virtual-word-start="${virtualWordStart}" data-virtual-word-end="${virtualWordEnd}" style="--rise-duration: ${riseDuration}s">${group.map((syllable, sylIdx) => {
            const startTimeMs = syllable.timestamp;
            const endTimeMs = syllable.endtime;
            const durationMs = endTimeMs - startTimeMs;
            const text = syllable.text || '';
            const romanizedText = this.showRomanization && syllable.romanizedText && syllable.romanizedText.trim() !== syllable.text.trim() ? b`<span class="lyrics-syllable transliteration no-chars ${groupLineSynced ? 'line-synced' : ''}" data-start-time="${startTimeMs}" data-end-time="${endTimeMs}" data-duration="${durationMs}" data-syllable-index="0" data-wipe-ratio="1">${syllable.romanizedText}</span>` : '';
            const animateSyllable = isAnimatedByChar && !groupLineSynced;
            let syllableContent = text;
            if (animateSyllable) {
              const numCharsInSyllable = Array.from(text.replace(/\s/g, '')).length || 1;
              let charIndexInsideSyllable = 0;
              syllableContent = b`${Array.from(text).map(char => {
                if (char === ' ') return ' ';
                const charIndexInsideWord = groupCharOffset + sylCharAccumulator;
                const localCharIndex = charIndexInsideSyllable;
                sylCharAccumulator += 1;
                charIndexInsideSyllable += 1;
                return b`<span class="char-motion"><span class="char" data-char-index="${charIndexInsideWord}" data-syllable-char-index="${charIndexInsideWord}" style="--word-wipe-width: ${numCharsInSyllable}ch; --char-wipe-position: -${localCharIndex}ch">${char}</span></span>`;
              })}`;
            }
            return b`<span class="lyrics-syllable-wrap${romanizedText ? ' has-transliteration' : ''}"><span class="lyrics-syllable${lineIsRTL ? ' rtl-text' : ''}${groupLineSynced ? ' line-synced' : ''}${animateSyllable ? ' has-chars' : ' no-chars'}" data-start-time="${startTimeMs}" data-end-time="${endTimeMs}" data-duration="${durationMs}" data-word-duration="${wordDuration}" data-syllable-index="${sylIdx}" data-word-index="${groupIdx}" data-word-length="${visibleWordLength}" data-wipe-ratio="1">${syllableContent}</span>${romanizedText}</span>`;
          })}</span>`;
        })} </p>`;
        // Translation container (if enabled)
        // Hide translation if it matches the original line text
        const fullLineText = line.text.map(s => s.text).join('').trim();
        const translationElement = this.showTranslation && line.translation && line.translation.trim() !== fullLineText ? b`<div class="lyrics-translation-container"> ${line.translation} </div>` : '';
        // Line-synced romanization (fallback if no word-level romanization)
        // Hide if the romanized text matches the original line text
        const lineRomanizationElement = this.showRomanization && line.romanizedText && !line.text.some(s => s.romanizedText) && line.romanizedText.trim() !== fullLineText ? b`<div class="lyrics-romanization-container ${lineIsRTL ? 'rtl-text' : ''}"> ${line.romanizedText} </div>` : '';
        // Check for instrumental gap before this line
        let maybeInstrumentalBlock = null;
        const gapForLine = gapByIndex.get(lineIndex);
        if (gapForLine) {
          const gapDuration = gapForLine.gapEnd - gapForLine.gapStart;
          // Calculate dot timing for fill-up animation (3 dots)
          const dotDuration = gapDuration / 3;
          // Gap starts without 'active' — _onTimeChanged toggles it imperatively
          maybeInstrumentalBlock = b`<div id="gap-${lineIndex}" class="lyrics-line lyrics-gap" aria-hidden="true" data-start-time="${gapForLine.gapStart}" data-end-time="${gapForLine.gapEnd}"> <p class="main-vocal-container"> <span class="lyrics-word"><span class="lyrics-syllable-wrap"><span class="lyrics-syllable" data-start-time="${gapForLine.gapStart}" data-end-time="${gapForLine.gapStart + dotDuration}" data-duration="${dotDuration}" data-wipe-ratio="1" data-syllable-index="0"></span></span><span class="lyrics-syllable-wrap"><span class="lyrics-syllable" data-start-time="${gapForLine.gapStart + dotDuration}" data-end-time="${gapForLine.gapStart + dotDuration * 2}" data-duration="${dotDuration}" data-wipe-ratio="1" data-syllable-index="1"></span></span><span class="lyrics-syllable-wrap"><span class="lyrics-syllable" data-start-time="${gapForLine.gapStart + dotDuration * 2}" data-end-time="${gapForLine.gapEnd}" data-duration="${dotDuration}" data-wipe-ratio="1" data-syllable-index="2"></span></span></span> </p> </div>`;
        }
        return b` ${maybeInstrumentalBlock} <div id="${lineId}" class="lyrics-line ${line.alignment === 'end' ? 'singer-right' : 'singer-left'} ${lineIsRTL ? 'rtl-text' : ''} ${hasBackground ? `bg-${bgPlacement}` : ''}" role="${isUnsynced ? 'paragraph' : 'button'}" aria-label="${isUnsynced ? fullLineText : `Seek to lyric: ${fullLineText}`}" data-start-time="${lineStartTime}" data-end-time="${lineEndTime}" @click="${() => this.handleLineClick(line)}" tabindex="${isUnsynced ? -1 : 0}" @keydown="${e => {
          if (e.key === 'Enter' || e.key === ' ') {
            this.handleLineClick(line);
          }
        }}"> <div class="lyrics-line-container ${lineIsRTL ? 'rtl-text' : ''}"> ${bgPlacement === 'before' ? backgroundVocalElement : ''} ${mainVocalElement} ${bgPlacement === 'after' ? backgroundVocalElement : ''} ${lineRomanizationElement} ${translationElement} </div> </div> `;
      });
    };
    return b` <div class="lyrics-container ${isUnsynced ? 'is-unsynced' : ''} ${!isUnsynced && !this.noBlur ? 'blur-inactive-enabled' : ''} ${hasDuetLines ? 'has-duet-lines' : ''} ${this.shouldReduceMotion ? 'reduced-motion' : ''}" role="region" aria-label="Synced lyrics"> ${!this.isLoading && this.lyrics && this.lyrics.length > 0 ? b` <div class="lyrics-header"> <div class="header-controls"> <button type="button" class="download-button ${this.showRomanization ? 'active' : ''}" @click="${this.toggleRomanization}" title="Toggle Romanization" aria-label="Toggle romanization" aria-pressed="${this.showRomanization}"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-speech-icon lucide-speech"> <path d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20"/> <path d="M19.8 17.8a7.5 7.5 0 0 0 .003-10.603"/> <path d="M17 15a3.5 3.5 0 0 0-.025-4.975"/> </svg> </button> <button type="button" class="download-button ${this.showTranslation ? 'active' : ''}" @click="${this.toggleTranslation}" title="Toggle Translation" aria-label="Toggle translation" aria-pressed="${this.showTranslation}"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages-icon lucide-languages"> <path d="m5 8 6 6"/> <path d="m4 14 6-6 2-3"/> <path d="M2 5h12"/> <path d="M7 2h1"/> <path d="m22 22-5-10-5 10"/> <path d="M14 18h6"/> </svg> </button> </div> <div class="download-controls"> <select class="format-select" aria-label="Lyrics download format" @change="${e => {
      this.downloadFormat = e.target.value;
    }}" .value="${this.downloadFormat}" @click="${e => e.stopPropagation()}"> <option value="auto">Auto</option> <option value="lrc">LRC</option> <option value="ttml">TTML</option> <option value="plain">Plain</option> </select> <button type="button" class="download-button" @click="${this.downloadLyrics}" title="Download Lyrics" aria-label="Download lyrics"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"> <path d="M12 15V3"/> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/> <path d="m7 10 5 5 5-5"/> </svg> </button> </div> </div> ` : ''} ${renderContent()} ${!this.isLoading ? b` <footer class="lyrics-footer lyrics-line"> <div class="footer-content"> <span class="source-info" style="display: flex; align-items: center; gap: 8px;"> <b style="font-weight: 750;">Source</b> ${sourceLabel} ${this.availableSources && this.availableSources.length > 1 || !this.hasFetchedAllProviders ? b` <button type="button" class="download-button source-switch-btn" title="Switch Lyrics Source" aria-label="Switch lyrics source" @click="${this.switchSource}" ?disabled="${this.isFetchingAlternatives}"> <svg class="source-switch-svg lucide lucide-arrow-down-up-icon lucide-arrow-down-up ${this.isFetchingAlternatives ? 'is-loading' : ''}" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> ${this.isFetchingAlternatives ? w`<path
                                    d="M21 12a9 9 0 1 1-6.219-8.56"
                                  ></path>` : w`<path d="m3 16 4 4 4-4"></path
                                    ><path d="M7 20V4"></path
                                    ><path d="m21 8-4-4-4 4"></path
                                    ><path d="M17 4v16"></path>`} </svg> <span class="source-switch-label">${this.isFetchingAlternatives ? 'Switching...' : 'Switch'}</span> </button> ` : ''} </span> ${this.songwriters ? b`<span class="songwriters-info" style="margin-top: 4px; font-weight: normal; font-size: 0.9em;"> <b style="font-weight: 750;">Songwriters</b> ${this.songwriters} </span>` : ''} </div> </footer> ` : ''} </div> `;
  }
}
AmLyrics.styles = i$3`:host{--lyplus-lyrics-palette:var(--am-lyrics-highlight-color,var(--highlight-color,#fff));--lyplus-text-primary:var(--lyplus-lyrics-palette);--lyplus-text-secondary:color-mix(in srgb,var(--lyplus-lyrics-palette),transparent 45%);--lyplus-padding-base:1em;--lyplus-padding-line:10px;--lyplus-padding-gap:.3em;--lyplus-border-radius-base:.6em;--lyplus-gap-dot-size:.4em;--lyplus-gap-dot-margin:.08em;--lyplus-font-size-base:34px;--lyplus-font-size-base-grow:24.5;--lyplus-font-size-subtext:.6em;--am-lyrics-line-height:1.2;--am-lyrics-line-spacing:25px;--am-lyrics-background-vocal-spacing:15px;--am-lyrics-background-vocal-font-size:.65em;--am-lyrics-background-vocal-stack-shift:7.5px;--am-lyrics-background-vocal-max-height:8em;--am-lyrics-background-vocal-enter-duration:.65s;--am-lyrics-background-vocal-exit-duration:.45s;--am-lyrics-instrumental-height:40px;--am-lyrics-instrumental-spacing:16px;--am-lyrics-instrumental-enter-duration:.4s;--am-lyrics-instrumental-collapse-duration:.5s;--am-lyrics-instrumental-exit-duration:.35s;--am-lyrics-instrumental-exit-scale:0;--am-lyrics-inactive-scale:.98;--am-lyrics-background-vocal-scale:.96;--am-lyrics-touch-scale:.96;--am-lyrics-highlight-radius:16px;--am-lyrics-highlight-surface:#ffffff14;--am-lyrics-progression-feather:30px;--am-lyrics-glow-radius:5px;--am-lyrics-inline-padding:20px;--am-lyrics-lift:1;--char-rise-y:-3px;--am-lyrics-character-rise-peak:-1.25px;--lyplus-blur-amount:.07em;--lyplus-blur-amount-near:.035em;--lyplus-fade-gap-timing-function:ease-out;--wipe-gradient-width:var(--am-lyrics-progression-feather);--wipe-gradient-half:calc(var(--am-lyrics-progression-feather)/2);--lyrics-scroll-padding-top:12%;height:100%;color:var(--lyplus-text-primary);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;background:0 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Open Sans,Helvetica Neue,sans-serif;font-weight:700;display:block;overflow:hidden;container-type:inline-size}.lyrics-container{padding:60px var(--am-lyrics-inline-padding)calc(var(--am-lyrics-instrumental-height) + var(--am-lyrics-instrumental-spacing));-webkit-overflow-scrolling:touch;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;box-sizing:border-box;scrollbar-width:none;overflow-anchor:none;overscroll-behavior-y:contain;width:100%;height:100%;max-height:100vh;background-color:#0000;scroll-padding-block-start:var(--lyrics-scroll-padding-top);position:relative;overflow-y:auto}.lyrics-container::-webkit-scrollbar{display:none}.lyrics-container.touch-scrolling .lyrics-line,.lyrics-container.touch-scrolling .lyrics-plus-metadata{filter:none!important;transition:none!important}.lyrics-container.wheel-scrolling .lyrics-line{filter:none!important;transition:transform .3s ease-out!important}.lyrics-container.user-scrolling .lyrics-line{--lyrics-line-delay:0s!important;transition-delay:0s!important}.lyrics-line{isolation:isolate;padding:0 var(--lyplus-padding-line);opacity:.8;color:var(--lyplus-text-secondary);font-size:var(--lyplus-font-size-base);line-height:var(--am-lyrics-line-height);cursor:pointer;transform-origin:0;transition:opacity .7s ease,transform .4s cubic-bezier(.41,0,.12,.99)var(--lyrics-line-delay,0s),filter .7s ease;contain:layout style;text-rendering:optimizeLegibility;margin-block-end:var(--am-lyrics-line-spacing);position:relative}.lyrics-line:before{content:"";z-index:-1;border-radius:var(--am-lyrics-highlight-radius);background:var(--am-lyrics-highlight-surface);opacity:0;pointer-events:none;transition:opacity .18s cubic-bezier(.2,0,0,1),transform .18s cubic-bezier(.2,0,0,1),box-shadow .18s ease-out;position:absolute;inset:-6px -8px;transform:scale(.98);box-shadow:0 0 0 1px #0000}.lyrics-line:focus-visible{outline:none}.lyrics-line:focus-visible:before{opacity:1;box-shadow:0 0 0 2px color-mix(in srgb,var(--lyplus-text-primary)72%,transparent);transform:scale(1)}.lyrics-line{animation:none}.lyrics-line-container{overflow-wrap:break-word;transform-origin:0;transform:translateZ(0)scale(var(--am-lyrics-inactive-scale));transition:transform .7s,background-color .7s,color .7s;position:relative}.lyrics-line.active .lyrics-line-container,.lyrics-line.pre-active .lyrics-line-container{transition:transform .5s,background-color .18s,color .18s;transform:translateZ(0)scale(1)}.main-vocal-container{transform-origin:5%;transition:transform var(--scroll-duration,.4s)cubic-bezier(.2,.8,.2,1);margin:0}.background-vocal-container{height:0;font-size:var(--am-lyrics-background-vocal-font-size);box-sizing:border-box;color:color-mix(in srgb,var(--lyplus-text-secondary)80%,transparent);pointer-events:none;margin:0;padding:0;line-height:1.22;position:relative;overflow:visible}.background-vocal-wrap{opacity:0;transform:translateY(var(--background-vocal-offset,6px))scale(var(--am-lyrics-background-vocal-scale));transform-origin:0;transition:opacity .28s cubic-bezier(.2,0,0,1),transform var(--am-lyrics-background-vocal-enter-duration)cubic-bezier(.22,1,.36,1);padding-top:.08em;padding-bottom:.14em;display:block}.lyrics-line.singer-right .background-vocal-container,.lyrics-line.rtl-text .background-vocal-container{margin-left:auto;margin-right:0}.lyrics-line.bg-expanded .background-vocal-container{height:var(--am-lyrics-background-vocal-height,var(--am-lyrics-background-vocal-max-height))}.lyrics-line.bg-expanded .background-vocal-wrap{opacity:1;transform:translateY(0)scale(1)}.lyrics-line.bg-collapsing .background-vocal-container{height:0}.lyrics-line.bg-collapsing .background-vocal-wrap{opacity:0;transform:translateY(var(--background-vocal-offset,6px))scale(var(--am-lyrics-background-vocal-scale));transition-duration:var(--background-vocal-exit-duration,.45s)}.background-vocal-container.background-after .background-vocal-wrap{padding-top:calc(var(--am-lyrics-background-vocal-spacing) + .08em)}.background-vocal-container.background-before .background-vocal-wrap{--background-vocal-offset:-6px;padding-bottom:calc(var(--am-lyrics-background-vocal-spacing) + .14em)}.lyrics-line.singer-right .background-vocal-wrap,.lyrics-line.rtl-text .background-vocal-wrap{transform-origin:100%}.lyrics-container.user-scrolling .background-vocal-container,.lyrics-container.user-scrolling .background-vocal-wrap,.lyrics-container.touch-scrolling .background-vocal-container,.lyrics-container.touch-scrolling .background-vocal-wrap{transition-duration:1ms!important}.lyrics-line.active{opacity:1;color:var(--lyplus-text-primary)}.lyrics-line.pre-active{opacity:1;transition:opacity .7s ease,transform .4s cubic-bezier(.41,0,.12,.99)var(--lyrics-line-delay,0s)}.lyrics-line.scroll-exiting{opacity:.8;color:var(--lyplus-text-secondary);filter:blur(var(--lyplus-blur-amount-near));transition:opacity var(--scroll-duration,.4s)cubic-bezier(.41,0,.12,.99),transform var(--scroll-duration,.4s)cubic-bezier(.41,0,.12,.99)var(--lyrics-line-delay,0s),filter var(--scroll-duration,.4s)ease}.lyrics-line.persist-highlight .lyrics-syllable.finished,.lyrics-line.persist-highlight .lyrics-syllable.finished span.char{transition:none!important}.lyrics-line.singer-right{text-align:end}.lyrics-line.singer-right .lyrics-line-container,.lyrics-line.singer-right .main-vocal-container{transform-origin:100%}.lyrics-line.rtl-text{transform-origin:100%;direction:rtl;text-align:right!important}.lyrics-line.rtl-text .lyrics-line-container,.lyrics-line.rtl-text .main-vocal-container{transform-origin:100%}.lyrics-line.rtl-text .lyrics-romanization-container,.lyrics-line.rtl-text .lyrics-translation-container{text-align:right}.lyrics-container.has-duet-lines .lyrics-line.singer-left{padding-inline-end:max(var(--lyplus-padding-line),15%)}.lyrics-container.has-duet-lines .lyrics-line.singer-right{padding-inline-start:max(var(--lyplus-padding-line),15%)}.lyrics-container.is-unsynced .lyrics-line{cursor:default;opacity:1!important;color:var(--lyplus-text-primary)!important;filter:none!important;transform:none!important}.lyrics-container.is-unsynced .lyrics-line-container{background-color:#0000!important;transform:none!important}.lyrics-container.is-unsynced .lyrics-syllable{color:var(--lyplus-text-primary)!important;background-color:#0000!important;-webkit-background-clip:unset!important;background-clip:unset!important;-webkit-text-fill-color:unset!important;text-fill-color:unset!important;text-shadow:none!important;filter:none!important;opacity:1!important;transform:none!important}@media (hover:hover) and (pointer:fine){.lyrics-line:hover{filter:none!important}.lyrics-container.is-unsynced .lyrics-line:hover{background:0 0!important}}.lyrics-line:not(.lyrics-gap):active .lyrics-line-container{transform:translateZ(0)scale(var(--am-lyrics-touch-scale));transition-duration:.12s}.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line:not(.active):not(.pre-active):not(.lyrics-gap){filter:blur(var(--lyplus-blur-amount))}.lyrics-line.far-line{filter:none!important;will-change:auto!important;animation:none!important}.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.post-active-line:not(.lyrics-gap):not(.active):not(.pre-active),.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.next-active-line:not(.lyrics-gap):not(.active):not(.pre-active),.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.lyrics-activest:not(.active):not(.lyrics-gap):not(.pre-active){filter:blur(var(--lyplus-blur-amount-near))}.lyrics-line.prev-2,.lyrics-line.next-2{opacity:.7}.lyrics-line.prev-3,.lyrics-line.next-3{opacity:.58}.lyrics-line.prev-4,.lyrics-line.next-4{opacity:.46}.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.next-active-line:not(.lyrics-gap):not(.active):not(.pre-active),.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.next-2:not(.lyrics-gap):not(.active):not(.pre-active){filter:blur(.028em)}.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.next-3:not(.lyrics-gap):not(.active):not(.pre-active){filter:blur(.05em)}.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-line.next-4:not(.lyrics-gap):not(.active):not(.pre-active){filter:blur(var(--lyplus-blur-amount))}.lyrics-container.user-scrolling .lyrics-line{filter:none!important;opacity:.8!important;transition:none!important}.lyrics-container.blur-inactive-enabled .lyrics-line.pre-active{opacity:1;filter:none!important}.lyrics-line.progressive-unblur{transition:opacity .7s ease,transform .4s cubic-bezier(.41,0,.12,.99)var(--lyrics-line-delay,0s),filter 0s linear}.lyrics-word:not(.allow-break){vertical-align:baseline;white-space:nowrap;display:inline-block}.lyrics-word.allow-break{display:inline}.lyrics-line .lyrics-word .lyrics-syllable.has-chars{transform:none!important}.lyrics-line .lyrics-word .lyrics-syllable .char.native-motion{transform-origin:50% 80%;transition-property:color,background-color!important}.reduced-motion .lyrics-line .lyrics-word .lyrics-syllable .char.native-motion{text-shadow:none!important;transform:none!important}.lyrics-word.char-rise,.lyrics-word.char-drag{vertical-align:baseline;white-space:nowrap;display:inline-block}.lyrics-word.char-rise.allow-break,.lyrics-word.char-drag.allow-break{white-space:normal;display:inline}.lyrics-syllable-wrap{display:inline}.lyrics-syllable-wrap.has-transliteration{flex-direction:column;align-items:start;display:inline-flex}.lyrics-syllable{vertical-align:baseline;color:#0000;background-color:var(--lyplus-text-secondary);white-space:pre-wrap;font-variant-ligatures:none;font-feature-settings:"liga" 0;-webkit-background-clip:text;background-clip:text;transition:color .7s,background-color .7s,transform .7s;display:inline-block}.lyrics-syllable.finished{background-color:var(--lyplus-text-primary);transition:transform 1s,background-color .7s,color .7s}.lyrics-syllable.finished.has-chars{background-color:#0000}.lyrics-line.active:not(.lyrics-gap) .lyrics-syllable{transition:transform 1s,background-color .5s,color .5s}.lyrics-line .lyrics-word .lyrics-syllable.line-synced{transform:none!important}.lyrics-line.active:not(.lyrics-gap) .lyrics-syllable.highlight.no-chars,.lyrics-line.active:not(.lyrics-gap) .lyrics-syllable.pre-highlight.no-chars{background-repeat:no-repeat;background-image:linear-gradient(90deg,var(--lyplus-text-primary,#fff)0%,var(--lyplus-text-primary,#fff)calc(100% - var(--wipe-gradient-width,.75em)),#0000 100%);background-position:0;background-size:0% 100%}.lyrics-line.active:not(.lyrics-gap) .lyrics-syllable.highlight.rtl-text,.lyrics-line.active:not(.lyrics-gap) .lyrics-syllable.pre-highlight.rtl-text{background-image:linear-gradient(-90deg,var(--lyplus-text-primary)0%,var(--lyplus-text-primary)calc(100% - var(--wipe-gradient-width,.75em)),transparent 100%);direction:rtl;background-position:right 0%;background-size:0% 100%}.lyrics-line.active .background-vocal-container .lyrics-syllable.highlight.no-chars,.lyrics-line.active .background-vocal-container .lyrics-syllable.pre-highlight.no-chars,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.highlight.no-chars,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.pre-highlight.no-chars{background-image:linear-gradient(90deg,color-mix(in srgb,var(--lyplus-text-primary,#fff)50%,#888)0%,color-mix(in srgb,var(--lyplus-text-primary,#fff)50%,#888)calc(100% - var(--wipe-gradient-width,.75em)),#0000 100%)}.lyrics-line.active .background-vocal-container .lyrics-syllable.highlight.rtl-text,.lyrics-line.active .background-vocal-container .lyrics-syllable.pre-highlight.rtl-text,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.highlight.rtl-text,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.pre-highlight.rtl-text{background-image:linear-gradient(-90deg,color-mix(in srgb,var(--lyplus-text-primary)50%,#888)0%,color-mix(in srgb,var(--lyplus-text-primary)50%,#888)calc(100% - var(--wipe-gradient-width,.75em)),transparent 100%)}.lyrics-line.active:not(.lyrics-gap) .lyrics-word.word-started .lyrics-syllable.no-chars,.lyrics-line.persist-highlight:not(.lyrics-gap) .lyrics-word .lyrics-syllable.no-chars.finished,.lyrics-word.growable .lyrics-syllable.cleanup .char,.lyrics-word.char-drag .lyrics-syllable.cleanup .char,.lyrics-line.persist-highlight .lyrics-word.growable .lyrics-syllable.finished .char,.lyrics-line.persist-highlight .lyrics-word.char-drag .lyrics-syllable.finished .char{transform:translate3d(0,calc(var(--char-rise-y,-1.12px)*var(--am-lyrics-lift)),0)}.background-vocal-container .lyrics-syllable{background-color:color-mix(in srgb,var(--lyplus-text-secondary)50%,#888)}.lyrics-line.active:not(.lyrics-gap) .background-vocal-container .lyrics-syllable.finished,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.finished{background-color:color-mix(in srgb,var(--lyplus-text-primary)50%,#888)}.background-vocal-container .lyrics-syllable.line-synced{color:color-mix(in srgb,var(--lyplus-text-secondary)50%,#888)!important}.lyrics-line.active:not(.lyrics-gap) .background-vocal-container .lyrics-syllable.line-synced,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.line-synced,.lyrics-line.active:not(.lyrics-gap) .background-vocal-container .lyrics-syllable.line-synced.finished,.lyrics-line.pre-active .background-vocal-container .lyrics-syllable.line-synced.finished{color:color-mix(in srgb,var(--lyplus-text-primary)50%,#888)!important}.lyrics-line.active:not(.lyrics-gap) .background-vocal-container .lyrics-word.word-started .lyrics-syllable.no-chars,.lyrics-line.persist-highlight:not(.lyrics-gap) .background-vocal-container .lyrics-word .lyrics-syllable.no-chars.finished{transform:translate3d(0,calc(var(--char-rise-y)*var(--am-lyrics-lift)),0)}.lyrics-line.active:not(.lyrics-gap) .lyrics-word.char-rise.word-started .lyrics-syllable.transliteration:not(.highlight):not(.finished){transform:none}.lyrics-syllable.pre-highlight{animation-name:pre-wipe-universal;animation-duration:var(--pre-wipe-duration);animation-delay:var(--pre-wipe-delay);animation-timing-function:linear;animation-fill-mode:forwards}.lyrics-syllable.pre-highlight.rtl-text{animation-name:pre-wipe-universal-rtl}.lyrics-syllable.transliteration{font-size:var(--lyplus-font-size-subtext);white-space:pre-wrap;pointer-events:none;user-select:none}.lyrics-line .lyrics-syllable.has-chars:not(.finished){color:#0000;background-color:#0000}.char-motion{vertical-align:baseline;transform-origin:50% 80%;display:inline-block}.lyrics-syllable .char-motion>.char,.reduced-motion .char-motion{transform:none!important}.lyrics-syllable span.char{background-color:var(--lyplus-text-secondary);white-space:break-spaces;font-variant-ligatures:none;font-feature-settings:"liga" 0;-webkit-text-fill-color:transparent;transform-origin:50% 80%;background-origin:content-box;-webkit-background-clip:text;background-clip:text;margin-inline:-.04em;padding-inline:.04em;transition:color .7s,background-color .7s,transform .7s;display:inline-block;position:relative}.lyrics-syllable .char.native-motion[data-glow]:after{content:attr(data-glyph);pointer-events:none;color:#0000;-webkit-text-fill-color:transparent;text-shadow:0 0 .3em rgb(255 255 255/var(--char-glow-max,0));animation:char-glow var(--char-glow-duration)linear var(--char-glow-delay)both;padding-inline:.04em;position:absolute;inset:0}@keyframes char-glow{0%,to{opacity:0}15%{opacity:.8}30%{opacity:1}60%{opacity:.3}}.reduced-motion .char:after{display:none}.lyrics-syllable.finished span.char{background-color:var(--lyplus-text-primary);transition:color .7s,background-color .7s,transform .7s}.lyrics-word.char-drag span.char{transition:color .18s}.lyrics-line.active .lyrics-syllable span.char{background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text;background-image:linear-gradient(90deg,var(--lyplus-text-primary,#fff)0%,var(--lyplus-text-primary,#fff)calc(100% - var(--wipe-gradient-width,.75em)),#0000 100%);background-size:calc(var(--word-wipe-width,1ch) + var(--wipe-gradient-width,.75em))100%;background-position:calc(var(--char-wipe-position,0px) - var(--word-wipe-width,1ch) - var(--wipe-gradient-width,.75em))0%;transition:transform .7s,color .18s}.lyrics-line.active .lyrics-syllable span.char.highlight{background-image:linear-gradient(-90deg,var(--lyplus-text-primary,#fff)0%,var(--lyplus-text-primary,#fff)calc(100% - var(--wipe-gradient-width,.75em)),#0000 100%);background-position:right 0%;background-size:0% 100%}.lyrics-line.active .lyrics-syllable span.char.pre-wipe-lead{animation-name:char-word-wipe;animation-duration:var(--pre-wipe-duration);animation-delay:var(--pre-wipe-delay);animation-timing-function:linear;animation-fill-mode:forwards}.lyrics-gap{--gap-scale:0;--gap-opacity:0;height:0;padding:0 var(--lyplus-padding-line);opacity:1;box-sizing:border-box;background-clip:unset;transform-origin:top;transition:transform var(--scroll-duration,.28s);align-items:center;margin-block-end:0;display:flex;overflow:visible;content-visibility:visible!important;contain:none!important}.lyrics-gap.active{height:calc(var(--am-lyrics-instrumental-height) + var(--am-lyrics-instrumental-spacing));transition:transform var(--scroll-duration,.28s)}.lyrics-gap.gap-collapsing{height:0;transition:transform var(--scroll-duration,.28s)}.lyrics-gap .main-vocal-container{height:calc(var(--am-lyrics-instrumental-height) + var(--am-lyrics-instrumental-spacing) + var(--am-lyrics-line-spacing));opacity:0;transform-origin:50%;transition:opacity var(--scroll-duration,.4s)cubic-bezier(.4,0,.6,1),transform var(--scroll-duration,.4s)cubic-bezier(.2,0,.2,1);will-change:transform,opacity;align-items:center;margin:0;line-height:1;display:flex;position:absolute;inset-block-start:calc(0px - var(--am-lyrics-line-spacing));inset-inline-start:var(--lyplus-padding-line);transform:scale(0)}.lyrics-gap.active .main-vocal-container{opacity:var(--gap-opacity);transform:scale(var(--gap-scale));transition:none}.lyrics-gap.gap-collapsing .main-vocal-container,.lyrics-gap.gap-exiting .main-vocal-container{height:calc(var(--am-lyrics-instrumental-height) + var(--am-lyrics-instrumental-spacing) + var(--am-lyrics-line-spacing))}.lyrics-gap.gap-exiting .main-vocal-container{opacity:var(--gap-exit-opacity,0);transform:scale(var(--gap-exit-scale,var(--am-lyrics-instrumental-exit-scale)));transition:none}.lyrics-gap .lyrics-word,.lyrics-gap .lyrics-syllable-wrap{align-items:center;height:100%;display:flex}.lyrics-gap .lyrics-syllable{width:var(--lyplus-gap-dot-size);height:var(--lyplus-gap-dot-size);background-color:var(--lyplus-text-primary);margin:0 var(--lyplus-gap-dot-margin);border-radius:50%;display:inline-block}.lyrics-syllable.line-synced{opacity:.55;color:var(--lyplus-lyrics-palette)!important;background:0 0!important}.lyrics-line:is(.active,.pre-active) .lyrics-syllable.line-synced{color:var(--lyplus-text-primary)!important;animation:.2s ease-out forwards fade-in-line!important}.lyrics-line:is(.active,.pre-active) .lyrics-syllable.line-synced span.char{background-image:none!important;background-color:var(--lyplus-text-primary)!important;transition:background-color .12s ease-out!important}@keyframes fade-in-line{0%{opacity:.5;color:var(--lyplus-text-secondary)}to{opacity:1;color:var(--lyplus-lyrics-palette)}}.lyrics-gap .lyrics-syllable{background-color:var(--lyplus-text-primary);background-clip:unset;opacity:var(--gap-dot-opacity,.25)}.lyrics-gap.active .lyrics-syllable.finished,.lyrics-gap.gap-exiting .lyrics-syllable.finished,.lyrics-gap:not(.active):not(.gap-exiting).post-active-line .lyrics-syllable,.lyrics-gap:not(.active):not(.gap-exiting).lyrics-activest .lyrics-syllable{background-color:var(--lyplus-text-primary);animation:none!important}.lyrics-plus-metadata{box-sizing:border-box;transform:translateY(var(--lyrics-scroll-offset,0px));transition:opacity .3s ease,transform .6s cubic-bezier(.23,1,.32,1)var(--lyrics-line-delay,0s),filter .3s ease;font-weight:400;display:block;position:relative}.lyrics-plus-empty{height:100vh;transform:translateY(var(--lyrics-scroll-offset,0px));display:block}.lyrics-footer{text-align:left;font-size:calc(var(--lyplus-font-size-base)*.5);color:var(--lyplus-text-secondary);opacity:.8;transform-origin:0;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-top:10px;padding:20px 0 50vh;font-weight:400;transition:opacity .3s,transform .5s cubic-bezier(.41,0,.12,.99),filter .3s;display:flex}.lyrics-footer.lyrics-line{font-size:calc(var(--lyplus-font-size-base)*.5);padding:20px var(--lyplus-padding-line)50vh var(--lyplus-padding-line);margin-top:0;margin-block-end:0}.lyrics-footer.active{opacity:1;color:#ffffff80}.lyrics-container.blur-inactive-enabled:not(.not-focused) .lyrics-footer:not(.active){filter:blur(var(--lyplus-blur-amount));opacity:.5}.lyrics-container.user-scrolling .lyrics-footer{filter:none!important;opacity:.8!important;transition:none!important}.lyrics-footer p{margin:5px 0}.lyrics-footer a{color:var(--lyplus-text-primary);text-underline-offset:2px;opacity:.8;transition:opacity .2s}.lyrics-footer a:hover{opacity:1}.footer-content{flex-direction:column;align-items:flex-start;gap:8px;display:flex}.footer-controls{align-items:center;display:flex}.lyrics-header{z-index:2;inset:10px var(--am-lyrics-inline-padding)auto;justify-content:space-between;align-items:center;gap:10px;height:40px;margin:0;padding:0;display:flex;position:absolute}.lyrics-header .download-button{cursor:pointer;width:40px;height:40px;color:color-mix(in srgb,var(--lyplus-text-primary)62%,transparent);vertical-align:middle;box-shadow:none;background:0 0;border:none;border-radius:12px;justify-content:center;align-items:center;margin:0;padding:0;font-family:inherit;transition:color .16s ease-out,background-color .16s ease-out,box-shadow .16s ease-out,transform .12s ease-out;display:inline-flex;position:relative}.lyrics-header .download-button:hover{color:var(--lyplus-text-primary);box-shadow:none;background:0 0}.lyrics-header .download-button.active{color:var(--lyplus-text-primary);background:0 0}.lyrics-header .download-button:active:not(:disabled){transform:scale(.96)}.lyrics-header .download-button:focus-visible,.source-switch-btn:focus-visible,.format-select:focus-visible{outline:2px solid color-mix(in srgb,var(--lyplus-text-primary)72%,transparent);outline-offset:2px}.header-controls{gap:8px;display:flex}.download-controls{align-items:center;gap:4px;display:flex}.source-switch-btn{box-sizing:border-box;color:#aaa;cursor:pointer;white-space:nowrap;background:#ffffff0f;border:0;border-radius:6px;flex:none;justify-content:center;align-items:center;height:26px;padding:0 8px;font-family:inherit;font-size:11px;line-height:1;transition:color .2s,border-color .2s,background-color .2s,transform .12s;display:inline-flex;position:relative}.source-switch-btn:active:not(:disabled){transform:scale(.96)}.source-switch-btn:disabled{cursor:default;opacity:.7}.source-switch-svg{flex:0 0 12px;width:12px;height:12px;margin-right:4px}.source-switch-svg.is-loading{animation:1s linear infinite source-switch-spin}.control-button{color:#fff9;cursor:pointer;background:0 0;border:1px solid #ffffff4d;border-radius:4px;padding:2px 8px;font-size:.8em;font-weight:400;transition:color .2s,border-color .2s,background-color .2s}.control-button:hover{color:#ffffffe6;border-color:#ffffff80}.control-button.active{background-color:var(--lyplus-text-primary);border-color:var(--lyplus-text-primary);color:#000}.format-select{box-sizing:border-box;color:#fff9;cursor:pointer;background:#ffffff0f;border:1px solid #ffffff4d;border-radius:6px;flex:none;height:28px;margin-left:0;padding:0 6px;font-family:inherit;font-size:12px;font-weight:400;line-height:normal}.format-select:hover{color:#ffffffe6;border-color:#ffffff80}.format-select option{color:#fff;background:#1a1a1a}.lyrics-translation-container,.lyrics-romanization-container{opacity:.8;font-size:var(--lyplus-font-size-subtext);overflow-wrap:break-word;pointer-events:none;user-select:none;padding-top:.2em;font-weight:400;transition:opacity .3s,color .3s}.lyrics-romanization-container{direction:ltr!important}.lyrics-romanization-container.rtl-text{text-align:right;direction:rtl!important}.lyrics-romanization-container .lyrics-syllable{white-space:pre-wrap}.lyrics-translation-container{opacity:.5}.main-line-wrapper.small{opacity:.8;margin-bottom:0;font-size:.5em;display:block}.translation-line{margin-top:0;font-size:1em;font-weight:700;line-height:1.1;display:block}.romanized-line{color:#ffffff80;margin-top:2px;font-size:.5em;font-weight:400;display:block}@keyframes skeleton-loading{0%{background-color:#ffffff1a}to{background-color:#fff3}}.skeleton-line{height:2.5em;margin:0 0 var(--am-lyrics-line-spacing);opacity:.7;border-radius:16px;width:60%;animation:1s linear infinite alternate skeleton-loading}.skeleton-line:nth-child(2n){width:80%}.skeleton-line:nth-child(3n){width:50%}.skeleton-line:nth-child(5n){width:70%}.no-lyrics{color:#ffffff80;text-align:center;padding:2em;font-size:1.2em;font-weight:400}@keyframes source-switch-spin{to{transform:rotate(360deg)}}@keyframes wipe{0%{background-position:0;background-size:0% 100%}to{background-size:calc(100% + var(--wipe-gradient-width,.75em))100%;background-position:0}}@keyframes wipe-from-pre{0%{background-size:var(--wipe-gradient-width,.75em)100%;background-position:0}to{background-size:calc(100% + var(--wipe-gradient-width,.75em))100%;background-position:0}}@keyframes start-wipe{0%{background-position:0;background-size:0% 100%}to{background-size:calc(100% + var(--wipe-gradient-width,.75em))100%;background-position:0}}@keyframes wipe-rtl{0%{background-position:right 0%;background-size:0% 100%}to{background-size:calc(100% + var(--wipe-gradient-width,.75em))100%;background-position:right 0%}}@keyframes wipe-from-pre-rtl{0%{background-size:var(--wipe-gradient-width,.75em)100%;background-position:right 0%}to{background-size:calc(100% + var(--wipe-gradient-width,.75em))100%;background-position:right 0%}}@keyframes start-wipe-rtl{0%{background-position:right 0%;background-size:0% 100%}to{background-size:calc(100% + var(--wipe-gradient-width,.75em))100%;background-position:right 0%}}@keyframes pre-wipe-universal{0%{background-position:0;background-size:0% 100%}to{background-size:var(--wipe-gradient-width,.75em)100%;background-position:0}}@keyframes pre-wipe-universal-rtl{0%{background-position:right 0%;background-size:0% 100%}to{background-size:var(--wipe-gradient-width,.75em)100%;background-position:right 0%}}@keyframes char-word-wipe{0%{background-position:calc(var(--char-wipe-position,0px) - var(--word-wipe-width,1ch) - var(--wipe-gradient-width,.75em))0%}to{background-position:var(--char-wipe-position,0px)0%}}@keyframes fade-gap{0%{background-color:var(--lyplus-text-secondary)}to{background-color:var(--lyplus-text-primary)}}@keyframes grow-static{0%,to{text-shadow:0 0 0 color-mix(in srgb,var(--lyplus-lyrics-palette),transparent 100%);transform:scale3d(1.01,1.01,1.1)translateY(-.05%)}30%,40%{text-shadow:0 0 .3em color-mix(in srgb,var(--lyplus-lyrics-palette),transparent 50%);transform:scale3d(1.1,1.1,1.1)translateY(-.05%)}}@keyframes fadeInUp{0%{opacity:0;transform:translateY(20px)}to{opacity:.7;transform:translateY(0)}}.opposite-turn{text-align:right}.singer-right{text-align:right;justify-content:flex-end}.singer-left{text-align:left;justify-content:flex-start}.progress-text{background:linear-gradient(to right,var(--lyplus-text-primary)0%,var(--lyplus-text-primary)var(--line-progress,0%),var(--lyplus-text-secondary)var(--line-progress,0%),var(--lyplus-text-secondary)100%);-webkit-text-fill-color:transparent;color:var(--lyplus-text-secondary);-webkit-background-clip:text;background-clip:text;display:inline-block;position:relative;transform:translate(0,0)}.progress-text:before{display:none}.active-line{font-weight:700}.background-text{color:var(--lyplus-text-secondary);flex-shrink:0;margin:0;font-size:.8em;font-style:normal;line-height:1.1;display:block}.background-text.before{order:-1}.background-text.after{order:1}.instrumental-line{color:var(--lyplus-text-secondary);align-items:baseline;gap:8px;padding:4px 10px;font-size:.9em;font-weight:400;animation:.22s fadeInUp;display:inline-flex}.instrumental-duration{color:var(--lyplus-text-secondary);font-size:.8em}@container (width<=519px){.lyrics-container{--lyplus-font-size-base:var(--am-lyrics-compact-font-size,28px);--am-lyrics-line-spacing:var(--am-lyrics-compact-line-spacing,20px);--am-lyrics-background-vocal-font-size:var(--am-lyrics-compact-background-vocal-font-size,.857em);--lyrics-scroll-padding-top:var(--am-lyrics-compact-selected-position,18%);--am-lyrics-inline-padding:14px}}@container (width>=900px){.lyrics-container{--lyplus-font-size-base:var(--am-lyrics-wide-font-size,48px);--am-lyrics-line-height:1.17;--am-lyrics-line-spacing:var(--am-lyrics-wide-line-spacing,32px);--am-lyrics-background-vocal-font-size:var(--am-lyrics-wide-background-vocal-font-size,.667em);--lyrics-scroll-padding-top:var(--am-lyrics-wide-selected-position,20%);--am-lyrics-inline-padding:32px}}@media (prefers-contrast:more){:host{--lyplus-text-secondary:color-mix(in srgb,var(--lyplus-lyrics-palette),transparent 24%)}.lyrics-line:focus-visible:before{box-shadow:0 0 0 3px var(--lyplus-text-primary)}}:host([no-blur]) .lyrics-line{filter:none!important;transition-property:opacity,transform!important}:host([hide-played-lines]) .lyrics-container:not(.user-scrolling):not(.touch-scrolling) .lyrics-line.played:not(:focus-within){opacity:0;pointer-events:none}.lyrics-container.reduced-motion .lyrics-line,.lyrics-container.reduced-motion .lyrics-line:before,.lyrics-container.reduced-motion .lyrics-line-container,.lyrics-container.reduced-motion .main-vocal-container,.lyrics-container.reduced-motion .background-vocal-container,.lyrics-container.reduced-motion .background-vocal-wrap,.lyrics-container.reduced-motion .lyrics-plus-metadata,.lyrics-container.reduced-motion .lyrics-footer{transition:none!important;animation:none!important}.lyrics-container.reduced-motion .lyrics-line,.lyrics-container.reduced-motion .lyrics-line-container,.lyrics-container.reduced-motion .main-vocal-container,.lyrics-container.reduced-motion .background-vocal-wrap,.lyrics-container.reduced-motion .lyrics-syllable,.lyrics-container.reduced-motion .lyrics-syllable span.char{transform:none!important}.lyrics-container.reduced-motion .lyrics-syllable span.char{filter:none!important;transition:none!important}`;
/**
 * Update syllables based on current time
 * Uses DOM caching and pre-highlight reset for smooth transitions
 */
AmLyrics.motionWords = new WeakMap();
AmLyrics.motionSyllables = new WeakMap();
AmLyrics.motionParameters = new WeakMap();
// Repeated syllable durations share sampled curves; bound memory across songs.
AmLyrics.characterFrames = new Map();
AmLyrics.characterAnimations = new WeakMap();
__decorate([n({
  type: String
})], AmLyrics.prototype, "query", void 0);
__decorate([n({
  type: String
})], AmLyrics.prototype, "musicId", void 0);
__decorate([n({
  type: String
})], AmLyrics.prototype, "isrc", void 0);
__decorate([n({
  type: String
})], AmLyrics.prototype, "ttml", void 0);
__decorate([n({
  type: String,
  attribute: 'song-title'
})], AmLyrics.prototype, "songTitle", void 0);
__decorate([r()], AmLyrics.prototype, "downloadFormat", void 0);
__decorate([n({
  type: String,
  attribute: 'song-artist'
})], AmLyrics.prototype, "songArtist", void 0);
__decorate([n({
  type: String,
  attribute: 'song-album'
})], AmLyrics.prototype, "songAlbum", void 0);
__decorate([n({
  type: String,
  attribute: 'songwriters'
})], AmLyrics.prototype, "songwriters", void 0);
__decorate([n({
  type: Number,
  attribute: 'song-duration'
})], AmLyrics.prototype, "songDurationMs", void 0);
__decorate([n({
  type: String,
  attribute: 'highlight-color'
})], AmLyrics.prototype, "highlightColor", void 0);
__decorate([n({
  type: String,
  attribute: 'font-family'
})], AmLyrics.prototype, "fontFamily", void 0);
__decorate([n({
  type: Boolean
})], AmLyrics.prototype, "autoScroll", void 0);
__decorate([n({
  type: Boolean
})], AmLyrics.prototype, "interpolate", void 0);
__decorate([n({
  type: Boolean,
  attribute: 'no-auto-alternates'
})], AmLyrics.prototype, "noAutoAlternates", void 0);
__decorate([n({
  type: Boolean,
  attribute: 'no-blur',
  reflect: true
})], AmLyrics.prototype, "noBlur", void 0);
__decorate([n({
  type: Boolean,
  attribute: 'hide-played-lines',
  reflect: true
})], AmLyrics.prototype, "hidePlayedLines", void 0);
__decorate([n({
  type: Boolean,
  attribute: 'reduced-motion'
})], AmLyrics.prototype, "reducedMotion", void 0);
__decorate([n({
  type: String,
  attribute: 'line-motion'
})], AmLyrics.prototype, "lineMotion", void 0);
__decorate([r()], AmLyrics.prototype, "systemReducedMotion", void 0);
__decorate([r()], AmLyrics.prototype, "showRomanization", void 0);
__decorate([r()], AmLyrics.prototype, "showTranslation", void 0);
__decorate([n({
  type: Number
})], AmLyrics.prototype, "duration", void 0);
__decorate([n({
  type: Number,
  attribute: 'currenttime',
  hasChanged: () => false
})], AmLyrics.prototype, "currentTime", null);
__decorate([r()], AmLyrics.prototype, "isLoading", void 0);
__decorate([r()], AmLyrics.prototype, "lyrics", void 0);
__decorate([r()], AmLyrics.prototype, "lyricsSource", void 0);
__decorate([r()], AmLyrics.prototype, "availableSources", void 0);
__decorate([r()], AmLyrics.prototype, "currentSourceIndex", void 0);
__decorate([e('.lyrics-container')], AmLyrics.prototype, "lyricsContainer", void 0);

window.customElements.define('am-lyrics', AmLyrics);
