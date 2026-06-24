import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { ref, onValue, set, get } from "firebase/database";

const ETAPAS = [
  { id: "orcamento",  label: "Orçamento",        cor: "#6B7280", icon: "💬" },
  { id: "pagamento",  label: "Pagamento",         cor: "#EC4899", icon: "💰" },
  { id: "arte",       label: "Arte",              cor: "#8B5CF6", icon: "🎨" },
  { id: "impressao",  label: "Impressão",         cor: "#3B82F6", icon: "🖨️" },
  { id: "acabamento", label: "Acabamento",        cor: "#F59E0B", icon: "✂️" },
  { id: "pronto",     label: "Pronto p/ Entrega", cor: "#10B981", icon: "✅" },
  { id: "entregue",   label: "Entregue",          cor: "#1F2937", icon: "📦" },
];

const PRODUTOS = [
  "Cartão de Visita","Flyer","Banner","Adesivo","Placa","Faixa",
  "Folder","Cardápio","Envelope","Papel Timbrado","Lona","Outro"
];

const RESPONSAVEIS = ["Ana","Bruno","Carlos","Diana","Eduardo"];

const PRIORIDADES = [
  { id: "normal",   label: "Normal",   cor: "#6B7280" },
  { id: "urgente",  label: "Urgente",  cor: "#F59E0B" },
  { id: "expresso", label: "Expresso", cor: "#EF4444" },
];

const FORM_VAZIO = {
  cliente:"", whatsapp:"", produto:"", descricao:"",
  quantidade:"", valor:"", prazo:"", responsavel:"",
  prioridade:"normal", etapa:"orcamento"
};

function gerarId() { return "P" + Date.now(); }
function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function diasRestantes(prazo) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const p = new Date(prazo); p.setHours(0,0,0,0);
  return Math.ceil((p - hoje) / 86400000);
}

// ── Firebase helpers ───────────────────────────────────────────────────────────
const PEDIDOS_REF = "pedidos";

async function dbSalvarTodos(pedidos) {
  await set(ref(db, PEDIDOS_REF), pedidos);
}

async function dbCarregar() {
  const snap = await get(ref(db, PEDIDOS_REF));
  if (!snap.exists()) return [];
  const val = snap.val();
  return Array.isArray(val) ? val : Object.values(val);
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────
function Toast({ msg }) {
  return (
    <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
      background:"#1C1917", color:"#fff", padding:"10px 20px", borderRadius:20,
      fontSize:13, fontWeight:600, zIndex:999, whiteSpace:"nowrap",
      boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
      {msg}
    </div>
  );
}

function Row({ label, val }) {
  if (!val && val !== 0) return null;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0",
      borderBottom:"1px solid #F5F5F4" }}>
      <span style={{ fontSize:13, color:"#78716C" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:"#1C1917",
        maxWidth:"60%", textAlign:"right" }}>{val}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", height:"60vh", gap:16 }}>
      <div style={{ width:40, height:40, border:"4px solid #E7E5E4",
        borderTop:"4px solid #F59E0B", borderRadius:"50%",
        animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ color:"#A8A29E", fontSize:14 }}>Carregando pedidos...</span>
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────────────────────
export default function GraficaCRM() {
  const [pedidos,           setPedidos]           = useState([]);
  const [carregando,        setCarregando]         = useState(true);
  const [tela,              setTela]               = useState("lista");
  const [pedidoSelecionado, setPedidoSelecionado]  = useState(null);
  const [filtroEtapa,       setFiltroEtapa]        = useState("todas");
  const [busca,             setBusca]              = useState("");
  const [form,              setForm]               = useState(FORM_VAZIO);
  const [editando,          setEditando]           = useState(false);
  const [toastMsg,          setToastMsg]           = useState("");
  const [salvando,          setSalvando]           = useState(false);
  const [online,            setOnline]             = useState(true);

  // Escuta mudanças em TEMPO REAL no Firebase
  useEffect(() => {
    const pedidosRef = ref(db, PEDIDOS_REF);
    const unsub = onValue(pedidosRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const lista = Array.isArray(val) ? val : Object.values(val);
        setPedidos(lista.filter(Boolean));
      } else {
        setPedidos([]);
      }
      setCarregando(false);
      setOnline(true);
    }, (err) => {
      console.error(err);
      setOnline(false);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  function toast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  async function salvarPedido() {
    if (!form.cliente || !form.produto) { toast("⚠️ Preencha cliente e produto."); return; }
    setSalvando(true);
    try {
      const atual = await dbCarregar();
      let novos;
      if (editando && pedidoSelecionado) {
        novos = atual.map(p => p.id === pedidoSelecionado.id ? { ...p, ...form } : p);
        setPedidoSelecionado({ ...pedidoSelecionado, ...form });
      } else {
        const novo = { ...form, id:gerarId(), criadoEm:new Date().toISOString(), historico:[] };
        novos = [novo, ...atual];
      }
      await dbSalvarTodos(novos);
      toast(editando ? "Pedido atualizado! ✅" : "Pedido criado! ✅");
      setEditando(false);
      setTela("lista");
    } catch(e) {
      toast("❌ Erro ao salvar. Verifique a conexão.");
    }
    setSalvando(false);
  }

  async function avancarEtapa(pedido) {
    const idx = ETAPAS.findIndex(e => e.id === pedido.etapa);
    if (idx >= ETAPAS.length - 1) return;
    const novaEtapa = ETAPAS[idx+1].id;
    const hist = [...(pedido.historico||[]), { de:pedido.etapa, para:novaEtapa, em:new Date().toISOString() }];
    const atual = await dbCarregar();
    const novos = atual.map(p => p.id === pedido.id ? { ...p, etapa:novaEtapa, historico:hist } : p);
    await dbSalvarTodos(novos);
    if (pedidoSelecionado?.id === pedido.id) setPedidoSelecionado({ ...pedido, etapa:novaEtapa, historico:hist });
    toast(`Movido para ${ETAPAS[idx+1].label} ✅`);
  }

  async function voltarEtapa(pedido) {
    const idx = ETAPAS.findIndex(e => e.id === pedido.etapa);
    if (idx <= 0) return;
    const novaEtapa = ETAPAS[idx-1].id;
    const atual = await dbCarregar();
    const novos = atual.map(p => p.id === pedido.id ? { ...p, etapa:novaEtapa } : p);
    await dbSalvarTodos(novos);
    if (pedidoSelecionado?.id === pedido.id) setPedidoSelecionado({ ...pedido, etapa:novaEtapa });
    toast(`Voltou para ${ETAPAS[idx-1].label}`);
  }

  async function excluirPedido(id) {
    if (!window.confirm("Excluir este pedido?")) return;
    const atual = await dbCarregar();
    const novos = atual.filter(p => p.id !== id);
    await dbSalvarTodos(novos);
    setTela("lista");
    toast("Pedido excluído.");
  }

  function abrirEdicao(p) { setForm({ ...p }); setEditando(true); }

  const etapaObj = (id) => ETAPAS.find(e => e.id === id) || ETAPAS[0];
  const corPrioridade = (id) => PRIORIDADES.find(p => p.id === id)?.cor || "#6B7280";

  const pedidosFiltrados = pedidos.filter(p => {
    const okEtapa = filtroEtapa === "todas" || p.etapa === filtroEtapa;
    const okBusca = !busca ||
      p.cliente?.toLowerCase().includes(busca.toLowerCase()) ||
      p.id?.includes(busca) ||
      p.produto?.toLowerCase().includes(busca.toLowerCase());
    return okEtapa && okBusca;
  });

  const stats = {
    total:     pedidos.length,
    ativos:    pedidos.filter(p => p.etapa !== "entregue").length,
    atrasados: pedidos.filter(p => p.prazo && p.etapa !== "entregue" && diasRestantes(p.prazo) < 0).length,
    hoje:      pedidos.filter(p => p.prazo && diasRestantes(p.prazo) === 0).length,
  };

  const base = { fontFamily:"'Inter',sans-serif", minHeight:"100vh", background:"#F8F7F4" };

  // ── TELA: NOVO / EDITAR ───────────────────────────────────────────────────────
  if (tela === "novo" || editando) {
    return (
      <div style={{ ...base, paddingBottom:80 }}>
        <div style={{ background:"#1C1917", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => { setTela("lista"); setEditando(false); }}
            style={{ background:"none", border:"none", color:"#A8A29E", fontSize:22, cursor:"pointer" }}>←</button>
          <span style={{ color:"#fff", fontWeight:700, fontSize:16 }}>
            {editando ? "Editar Pedido" : "Novo Pedido"}
          </span>
        </div>

        <div style={{ padding:"20px 16px", maxWidth:480, margin:"0 auto" }}>
          {[
            { label:"Cliente *",  key:"cliente",    ph:"Nome do cliente" },
            { label:"WhatsApp",   key:"whatsapp",   ph:"(24) 99999-0000" },
            { label:"Quantidade", key:"quantidade", ph:"Ex: 1000 unidades" },
            { label:"Valor (R$)", key:"valor",      ph:"Ex: 350,00" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:4 }}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]:e.target.value }))}
                placeholder={f.ph}
                style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                  border:"1.5px solid #E7E5E4", fontSize:14, boxSizing:"border-box", background:"#fff" }} />
            </div>
          ))}

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:4 }}>Produto *</label>
            <select value={form.produto} onChange={e => setForm(x => ({ ...x, produto:e.target.value }))}
              style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                border:"1.5px solid #E7E5E4", fontSize:14, background:"#fff" }}>
              <option value="">Selecione...</option>
              {PRODUTOS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:4 }}>Descrição</label>
            <textarea value={form.descricao} onChange={e => setForm(x => ({ ...x, descricao:e.target.value }))}
              placeholder="Detalhes, formato, cores, observações..."
              rows={3} style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                border:"1.5px solid #E7E5E4", fontSize:14, boxSizing:"border-box",
                resize:"vertical", background:"#fff" }} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:4 }}>Prazo de entrega</label>
              <input type="date" value={form.prazo} onChange={e => setForm(x => ({ ...x, prazo:e.target.value }))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                  border:"1.5px solid #E7E5E4", fontSize:14, background:"#fff", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:4 }}>Responsável</label>
              <select value={form.responsavel} onChange={e => setForm(x => ({ ...x, responsavel:e.target.value }))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                  border:"1.5px solid #E7E5E4", fontSize:14, background:"#fff" }}>
                <option value="">Ninguém</option>
                {RESPONSAVEIS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:8 }}>Prioridade</label>
            <div style={{ display:"flex", gap:8 }}>
              {PRIORIDADES.map(p => (
                <button key={p.id} onClick={() => setForm(x => ({ ...x, prioridade:p.id }))}
                  style={{ flex:1, padding:"8px 4px", borderRadius:8,
                    border:`2px solid ${form.prioridade===p.id ? p.cor : "#E7E5E4"}`,
                    background:form.prioridade===p.id ? p.cor : "#fff",
                    color:form.prioridade===p.id ? "#fff" : "#78716C",
                    fontWeight:600, fontSize:12, cursor:"pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {editando && (
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#78716C", fontWeight:600, display:"block", marginBottom:4 }}>Etapa atual</label>
              <select value={form.etapa} onChange={e => setForm(x => ({ ...x, etapa:e.target.value }))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                  border:"1.5px solid #E7E5E4", fontSize:14, background:"#fff" }}>
                {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
              </select>
            </div>
          )}

          <button onClick={salvarPedido} disabled={salvando}
            style={{ width:"100%", padding:"14px",
              background: salvando ? "#A8A29E" : "#1C1917",
              color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:16,
              cursor: salvando ? "not-allowed" : "pointer", marginTop:8 }}>
            {salvando ? "Salvando..." : editando ? "Salvar Alterações" : "Criar Pedido"}
          </button>
        </div>
        {toastMsg && <Toast msg={toastMsg} />}
      </div>
    );
  }

  // ── TELA: DETALHE ─────────────────────────────────────────────────────────────
  if (tela === "detalhe" && pedidoSelecionado) {
    // Sempre busca versão mais recente do pedido
    const p = pedidos.find(x => x.id === pedidoSelecionado.id) || pedidoSelecionado;
    const etapa = etapaObj(p.etapa);
    const idxEtapa = ETAPAS.findIndex(e => e.id === p.etapa);
    const dias = diasRestantes(p.prazo);
    const atrasado = dias !== null && dias < 0 && p.etapa !== "entregue";
    return (
      <div style={{ ...base, paddingBottom:80 }}>
        <div style={{ background:"#1C1917", padding:"16px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={() => { setTela("lista"); setEditando(false); }}
                style={{ background:"none", border:"none", color:"#A8A29E", fontSize:22, cursor:"pointer" }}>←</button>
              <div>
                <div style={{ color:"#A8A29E", fontSize:11 }}>{p.id}</div>
                <div style={{ color:"#fff", fontWeight:700, fontSize:16 }}>{p.cliente}</div>
              </div>
            </div>
            <button onClick={() => abrirEdicao(p)}
              style={{ background:"#292524", border:"none", color:"#D6D3D1",
                borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer" }}>
              ✏️ Editar
            </button>
          </div>
        </div>

        <div style={{ background:"#fff", padding:"16px 20px", borderBottom:"1px solid #E7E5E4" }}>
          <div style={{ display:"flex", gap:4, marginBottom:12 }}>
            {ETAPAS.map((e, i) => (
              <div key={e.id} style={{ flex:1, height:6, borderRadius:4,
                background: i<=idxEtapa ? e.cor : "#E7E5E4", transition:"background 0.3s" }} />
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:14, fontWeight:700, color:etapa.cor }}>{etapa.icon} {etapa.label}</span>
            {dias !== null && (
              <span style={{ fontSize:12, fontWeight:600,
                color: atrasado ? "#EF4444" : dias===0 ? "#F59E0B" : "#10B981" }}>
                {atrasado ? `${Math.abs(dias)} dia(s) atrasado` : dias===0 ? "Entrega hoje!" : `${dias} dia(s) restante(s)`}
              </span>
            )}
          </div>
        </div>

        <div style={{ padding:"16px 20px" }}>
          <div style={{ background:"#fff", borderRadius:12, padding:16, marginBottom:12, border:"1px solid #E7E5E4" }}>
            <Row label="Produto"     val={p.produto} />
            <Row label="Quantidade"  val={p.quantidade} />
            <Row label="Valor"       val={p.valor ? `R$ ${p.valor}` : null} />
            <Row label="Prazo"       val={formatarData(p.prazo)} />
            <Row label="Responsável" val={p.responsavel} />
            <Row label="Prioridade"  val={
              <span style={{ color:corPrioridade(p.prioridade), fontWeight:600 }}>
                {PRIORIDADES.find(x => x.id===p.prioridade)?.label}
              </span>
            } />
            {p.descricao && <Row label="Descrição" val={p.descricao} />}
            <Row label="Criado em"   val={formatarData(p.criadoEm)} />
            {p.whatsapp && (
              <div style={{ marginTop:12 }}>
                <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g,"")}`}
                  target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                    background:"#25D366", color:"#fff", borderRadius:8,
                    textDecoration:"none", fontWeight:600, fontSize:13 }}>
                  📱 Abrir WhatsApp — {p.whatsapp}
                </a>
              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <button onClick={() => voltarEtapa(p)} disabled={idxEtapa===0}
              style={{ padding:"12px", borderRadius:10, border:"1.5px solid #E7E5E4",
                background:"#fff", color: idxEtapa===0 ? "#D6D3D1" : "#57534E",
                fontWeight:600, fontSize:13, cursor: idxEtapa===0 ? "not-allowed" : "pointer" }}>
              ← Voltar etapa
            </button>
            <button onClick={() => avancarEtapa(p)} disabled={idxEtapa===ETAPAS.length-1}
              style={{ padding:"12px", borderRadius:10, border:"none",
                background: idxEtapa===ETAPAS.length-1 ? "#E7E5E4" : etapa.cor,
                color: idxEtapa===ETAPAS.length-1 ? "#A8A29E" : "#fff",
                fontWeight:700, fontSize:13,
                cursor: idxEtapa===ETAPAS.length-1 ? "not-allowed" : "pointer" }}>
              Avançar →
            </button>
          </div>

          {p.historico?.length > 0 && (
            <div style={{ background:"#fff", borderRadius:12, padding:16,
              border:"1px solid #E7E5E4", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#78716C", marginBottom:10 }}>HISTÓRICO</div>
              {p.historico.map((h, i) => (
                <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#10B981",
                    marginTop:4, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:13, color:"#292524" }}>
                      {etapaObj(h.de).label} → {etapaObj(h.para).label}
                    </div>
                    <div style={{ fontSize:11, color:"#A8A29E" }}>
                      {new Date(h.em).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => excluirPedido(p.id)}
            style={{ width:"100%", padding:"12px", background:"none",
              border:"1.5px solid #FCA5A5", color:"#EF4444", borderRadius:10,
              fontWeight:600, fontSize:13, cursor:"pointer" }}>
            🗑️ Excluir pedido
          </button>
        </div>
        {toastMsg && <Toast msg={toastMsg} />}
      </div>
    );
  }

  // ── TELA: LISTA PRINCIPAL ─────────────────────────────────────────────────────
  return (
    <div style={base}>
      <div style={{ background:"#1C1917", padding:"16px 20px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <div style={{ color:"#A8A29E", fontSize:11, letterSpacing:1 }}>GRÁFICA</div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>Pedidos</div>
          </div>
          <button onClick={() => { setForm(FORM_VAZIO); setEditando(false); setTela("novo"); }}
            style={{ background:"#F59E0B", border:"none", color:"#1C1917",
              borderRadius:10, padding:"9px 16px", fontWeight:700, fontSize:14, cursor:"pointer" }}>
            + Novo
          </button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
          {[
            { label:"Total",     val:stats.total,     cor:"#A8A29E" },
            { label:"Ativos",    val:stats.ativos,    cor:"#60A5FA" },
            { label:"Atrasados", val:stats.atrasados, cor:"#F87171" },
            { label:"Hoje",      val:stats.hoje,      cor:"#34D399" },
          ].map(s => (
            <div key={s.label} style={{ background:"#292524", borderRadius:8,
              padding:"8px 6px", textAlign:"center" }}>
              <div style={{ color:s.cor, fontWeight:800, fontSize:18 }}>{s.val}</div>
              <div style={{ color:"#78716C", fontSize:10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente, produto ou nº do pedido..."
          style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"none",
            fontSize:13, background:"#292524", color:"#fff", boxSizing:"border-box" }} />
      </div>

      <div style={{ overflowX:"auto", whiteSpace:"nowrap", padding:"10px 16px",
        background:"#fff", borderBottom:"1px solid #E7E5E4" }}>
        {[{ id:"todas", label:"Todas", cor:"#1C1917", icon:"📋" }, ...ETAPAS].map(e => (
          <button key={e.id} onClick={() => setFiltroEtapa(e.id)}
            style={{ display:"inline-block", marginRight:6, padding:"6px 12px", borderRadius:20,
              border:`1.5px solid ${filtroEtapa===e.id ? e.cor : "#E7E5E4"}`,
              background: filtroEtapa===e.id ? e.cor : "#fff",
              color: filtroEtapa===e.id ? "#fff" : "#78716C",
              fontWeight:600, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
            {e.icon} {e.label}
            {e.id !== "todas" && (
              <span style={{ marginLeft:4, opacity:0.8 }}>
                ({pedidos.filter(p => p.etapa === e.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding:"12px 16px", paddingBottom:80 }}>
        {carregando ? <Spinner /> : pedidosFiltrados.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:"#A8A29E" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🖨️</div>
            <div style={{ fontWeight:600, marginBottom:4 }}>Nenhum pedido aqui</div>
            <div style={{ fontSize:13 }}>Crie um novo pedido para começar</div>
          </div>
        ) : pedidosFiltrados.map(p => {
          const etapa = etapaObj(p.etapa);
          const dias = diasRestantes(p.prazo);
          const atrasado = dias !== null && dias < 0 && p.etapa !== "entregue";
          return (
            <div key={p.id}
              onClick={() => { setPedidoSelecionado(p); setTela("detalhe"); }}
              style={{ background:"#fff", borderRadius:12, padding:"14px 16px", marginBottom:10,
                border:`1.5px solid ${atrasado ? "#FCA5A5" : "#E7E5E4"}`,
                cursor:"pointer", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4,
                background:etapa.cor, borderRadius:"12px 0 0 12px" }} />
              <div style={{ paddingLeft:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:"#1C1917" }}>{p.cliente}</div>
                    <div style={{ fontSize:12, color:"#78716C", marginTop:2 }}>
                      {p.produto}{p.quantidade ? ` · ${p.quantidade}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:"#A8A29E" }}>{p.id}</div>
                    {p.valor && <div style={{ fontSize:13, fontWeight:700, color:"#10B981" }}>R$ {p.valor}</div>}
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:etapa.cor,
                    background:etapa.cor+"18", padding:"3px 8px", borderRadius:20 }}>
                    {etapa.icon} {etapa.label}
                  </span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    {p.responsavel && <span style={{ fontSize:11, color:"#78716C" }}>👤 {p.responsavel}</span>}
                    {dias !== null && (
                      <span style={{ fontSize:11, fontWeight:600,
                        color: atrasado ? "#EF4444" : dias===0 ? "#F59E0B" : "#78716C" }}>
                        {atrasado ? `⚠️ ${Math.abs(dias)}d atraso` : dias===0 ? "⏰ Hoje" : `📅 ${dias}d`}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", gap:2, marginTop:8 }}>
                  {ETAPAS.map((e, i) => {
                    const idx = ETAPAS.findIndex(x => x.id===p.etapa);
                    return <div key={e.id} style={{ flex:1, height:3, borderRadius:2,
                      background: i<=idx ? e.cor : "#E7E5E4" }} />;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff",
        borderTop:"1px solid #E7E5E4", padding:"8px 16px 12px",
        display:"flex", justifyContent:"center", alignItems:"center", gap:6 }}>
        <div style={{ width:8, height:8, borderRadius:"50%",
          background: online ? "#10B981" : "#EF4444" }} />
        <span style={{ fontSize:11, color:"#78716C" }}>
          {online ? "Ao vivo — mudanças aparecem em todos os computadores na hora" : "Sem conexão — verifique a internet"}
        </span>
      </div>

      {toastMsg && <Toast msg={toastMsg} />}
    </div>
  );
}
