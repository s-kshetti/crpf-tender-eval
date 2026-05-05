import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// ── Types — match backend response exactly ────────────────────────────────────
interface CriterionResult {
  criterion_id: string;
  criterion_description: string;
  criterion_type: string;
  mandatory: boolean;
  extracted_value: string | null;
  confidence: number;
  source_document: string;
  page_reference: string;
  extraction_reason: string;
  verdict: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'MANUAL_REVIEW';
  verdict_reason: string;
  human_override: string | null;
  override_reason: string | null;
}

interface BidderEval {
  bidder_id: string;
  bidder_name: string;
  overall_verdict: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'MANUAL_REVIEW';
  criterion_results: CriterionResult[];   // ← backend sends criterion_results
  documents: { filename: string; doc_type: string }[];
}

interface ReportData {
  run_id: string;
  tender_filename: string;
  criteria: any[];
  bidders: BidderEval[];                  // ← backend sends bidders
  summary: {
    total: number;
    eligible: number;
    not_eligible: number;
    manual_review: number;
  };
}

// ── Verdict styling ───────────────────────────────────────────────────────────
const VS = {
  ELIGIBLE:      { bg:'bg-emerald-50', border:'border-emerald-300', text:'text-emerald-700', badge:'bg-emerald-100 text-emerald-800', dot:'bg-emerald-500', label:'Eligible' },
  NOT_ELIGIBLE:  { bg:'bg-red-50',     border:'border-red-300',     text:'text-red-700',     badge:'bg-red-100 text-red-800',         dot:'bg-red-500',     label:'Not Eligible' },
  MANUAL_REVIEW: { bg:'bg-amber-50',   border:'border-amber-300',   text:'text-amber-700',   badge:'bg-amber-100 text-amber-800',     dot:'bg-amber-400',   label:'Manual Review' },
};

function Badge({ verdict }: { verdict: keyof typeof VS }) {
  const s = VS[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const col = value >= 0.75 ? 'bg-emerald-500' : value >= 0.5 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Evidence modal ────────────────────────────────────────────────────────────
function EvidenceModal({
  result, onClose
}: { result: CriterionResult; onClose: () => void }) {
  const s = VS[result.verdict];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${s.border}`}>
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">{result.criterion_id}</p>
            <p className="text-sm font-semibold text-gray-800 mb-1.5">{result.criterion_description}</p>
            <Badge verdict={result.verdict} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <Row label="Extracted Value">
            <span className={result.extracted_value ? 'text-gray-800 font-medium' : 'text-gray-400 italic'}>
              {result.extracted_value ?? 'Not found in documents'}
            </span>
          </Row>

          <Row label="Confidence">
            <ConfBar value={result.confidence} />
          </Row>

          <Row label="Source Document">
            <span className="text-gray-700">{result.source_document}</span>
            {result.page_reference && (
              <span className="text-gray-400 text-xs ml-1">· {result.page_reference}</span>
            )}
          </Row>

          <div className={`rounded-xl p-4 ${s.bg} border ${s.border}`}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Verdict Reason</p>
            <p className={`text-sm ${s.text}`}>{result.verdict_reason}</p>
          </div>

          {result.extraction_reason && (
            <div className="rounded-xl p-4 bg-gray-50 border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Extraction Detail</p>
              <p className="text-sm text-gray-600">{result.extraction_reason}</p>
            </div>
          )}

          {result.human_override && (
            <div className="rounded-xl p-4 bg-purple-50 border border-purple-200">
              <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">
                Human Override → {result.human_override}
              </p>
              <p className="text-sm text-purple-700">{result.override_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Report() {
  const { runId } = useParams();
  const navigate  = useNavigate();

  const [report,   setReport]   = useState<ReportData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [selected, setSelected] = useState<CriterionResult | null>(null);

  useEffect(() => {
    if (!runId) return;
    axios.get(`http://localhost:8000/api/run/${runId}/report`)
      .then((res) => { setReport(res.data); setLoading(false); })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? 'Failed to load report.');
        setLoading(false);
      });
  }, [runId]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading evaluation report…</p>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-purple-700 underline text-sm">
          ← Back to upload
        </button>
      </div>
    </div>
  );

  // ── No bidders yet ────────────────────────────────────────────────────────
  if (!report || !report.bidders?.length) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <button onClick={() => navigate(-1)} className="text-sm text-purple-700 underline mb-6 block">
          ← Back to criteria
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Evaluation Report</h1>
        <p className="text-gray-500 text-sm mb-10">Run ID: {runId}</p>
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1 font-medium">No bidders evaluated yet.</p>
          <p className="text-sm mb-4">Go back and evaluate at least one bidder first.</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold"
          >
            ← Evaluate a Bidder
          </button>
        </div>
      </div>
    </div>
  );

  const { summary, bidders } = report;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-8">

        {/* Back */}
        <button onClick={() => navigate(-1)} className="text-sm text-purple-700 underline mb-6 block">
          ← Back to criteria
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">Run ID: {runId}</p>
            <h1 className="text-3xl font-bold text-gray-900">Evaluation Report</h1>
            <p className="text-gray-500 text-sm mt-1">{report.tender_filename}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="bg-purple-700 hover:bg-purple-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label:'Total Bidders', value: summary.total,        color:'text-gray-800' },
            { label:'Eligible',      value: summary.eligible,     color:'text-emerald-600' },
            { label:'Not Eligible',  value: summary.not_eligible, color:'text-red-600' },
            { label:'Manual Review', value: summary.manual_review,color:'text-amber-600' },
          ].map((c) => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
              <p className={`text-4xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Bidder cards */}
        <div className="space-y-6">
          {bidders.map((bidder) => {
            const s = VS[bidder.overall_verdict];
            return (
              <div key={bidder.bidder_id} className={`bg-white border-2 ${s.border} rounded-2xl overflow-hidden shadow-sm`}>

                {/* Bidder header */}
                <div className={`flex items-center justify-between px-6 py-4 ${s.bg}`}>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{bidder.bidder_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {bidder.criterion_results?.length ?? 0} criteria evaluated
                      {bidder.documents?.length > 0 && ` · ${bidder.documents.length} document${bidder.documents.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <Badge verdict={bidder.overall_verdict} />
                </div>

                {/* Criterion result rows */}
                {bidder.criterion_results?.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {bidder.criterion_results.map((result) => (
                      <button
                        key={result.criterion_id}
                        onClick={() => setSelected(result)}
                        className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                      >
                        {/* ID */}
                        <span className="font-mono text-xs font-bold text-purple-600 w-10 shrink-0">
                          {result.criterion_id}
                        </span>

                        {/* Description */}
                        <span className="flex-1 text-sm text-gray-700 truncate">
                          {result.criterion_description}
                        </span>

                        {/* Extracted value */}
                        <span className="hidden sm:block text-sm text-gray-500 w-36 truncate shrink-0">
                          {result.extracted_value ?? <span className="italic text-gray-300">—</span>}
                        </span>

                        {/* Confidence */}
                        <div className="w-24 shrink-0">
                          <ConfBar value={result.confidence} />
                        </div>

                        {/* Badge */}
                        <div className="shrink-0">
                          <Badge verdict={result.verdict} />
                        </div>

                        {/* Override marker */}
                        {result.human_override && (
                          <span className="text-xs font-bold text-purple-500 shrink-0">Overridden</span>
                        )}

                        {/* Arrow */}
                        <span className="text-gray-300 group-hover:text-gray-500 shrink-0">›</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic px-6 py-4">No results.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Evidence modal */}
        {selected && (
          <EvidenceModal result={selected} onClose={() => setSelected(null)} />
        )}

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center mt-10">
          Every verdict is backed by source document evidence. Click any row to see full details.
        </p>
      </div>
    </div>
  );
}