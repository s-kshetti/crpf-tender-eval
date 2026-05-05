import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Criterion {
  id: string;
  type: string;
  mandatory: boolean;
  description: string;
  threshold: number | null;
  unit: string | null;
  proof_required: string;
  raw_text: string;
}

const TYPE_COLORS: Record<string, string> = {
  financial:    'bg-blue-100 text-blue-800',
  technical:    'bg-green-100 text-green-800',
  compliance:   'bg-orange-100 text-orange-800',
  certification:'bg-purple-100 text-purple-800',
};

export default function Review() {
  const { runId } = useParams();
  const navigate = useNavigate();

  const [criteria, setCriteria]       = useState<Criterion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [bidderName, setBidderName]   = useState('');
  const [bidderFiles, setBidderFiles] = useState<File[]>([]);
  const [evaluating, setEvaluating]   = useState(false);
  const [evalError, setEvalError]     = useState('');

  // ── Load criteria from sessionStorage ────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(`criteria_${runId}`);
    if (stored) {
      try {
        setCriteria(JSON.parse(stored));
      } catch {
        setError('Could not parse criteria. Please go back and upload again.');
      }
    } else {
      setError('No criteria found. Please go back and upload a tender document first.');
    }
    setLoading(false);
  }, [runId]);

  // ── Evaluate bidder ───────────────────────────────────────────────────────
  const handleEvaluate = async () => {
    if (!bidderName.trim()) {
      setEvalError('Please enter the bidder company name.');
      return;
    }
    if (bidderFiles.length === 0) {
      setEvalError('Please upload at least one bidder document.');
      return;
    }

    setEvaluating(true);
    setEvalError('');

    try {
      const formData = new FormData();
      // Append bidder_name as a form field
      formData.append('bidder_name', bidderName.trim());
      bidderFiles.forEach((f) => formData.append('files', f));

      await axios.post(
        `http://localhost:8000/api/run/${runId}/bidder`,
        formData,
        { timeout: 120000 }
      );

      navigate(`/report/${runId}`);
    } catch (err: any) {
      console.error('Evaluation error:', err);
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join(' | ')
        : typeof detail === 'string'
        ? detail
        : 'Evaluation failed. Check the backend terminal for errors.';
      setEvalError(msg);
    } finally {
      setEvaluating(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-purple-700 underline text-sm"
          >
            ← Back to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="text-sm text-purple-700 underline mb-6 block"
        >
          ← Back to Upload
        </button>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-mono text-gray-400 mb-1">Run ID: {runId}</p>
          <h1 className="text-3xl font-bold text-gray-900">Extracted Criteria</h1>
          <p className="text-gray-500 text-sm mt-1">
            {criteria.length} eligibility criteria extracted from the tender document.
            Review them below, then add bidder submissions for evaluation.
          </p>
        </div>

        {/* Criteria cards */}
        <div className="grid gap-4 mb-10">
          {criteria.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="font-mono font-bold text-purple-700 text-sm">{c.id}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[c.type] ?? 'bg-gray-100 text-gray-700'}`}>
                  {c.type}
                </span>
                {c.mandatory && (
                  <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Mandatory
                  </span>
                )}
              </div>

              <p className="text-gray-800 font-medium text-sm mb-2">{c.description}</p>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                {c.threshold != null && (
                  <span>
                    <span className="font-semibold">Threshold:</span>{' '}
                    {c.threshold.toLocaleString()} {c.unit ?? ''}
                  </span>
                )}
                <span>
                  <span className="font-semibold">Proof:</span> {c.proof_required}
                </span>
              </div>

              {c.raw_text && (
                <p className="mt-3 text-xs text-gray-400 italic border-l-2 border-gray-200 pl-3">
                  "{c.raw_text.slice(0, 180)}{c.raw_text.length > 180 ? '…' : ''}"
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Evaluate bidder section ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Evaluate a Bidder</h2>
          <p className="text-sm text-gray-500 mb-6">
            Upload a bidder's supporting documents and the system will check them
            against every criterion above.
          </p>

          {/* Bidder name */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Bidder Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bidderName}
              onChange={(e) => { setBidderName(e.target.value); setEvalError(''); }}
              placeholder="e.g. Alpha Constructions Pvt Ltd"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* File upload */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Bidder Documents{' '}
              <span className="font-normal text-gray-400">(PDF, DOCX, JPG, PNG)</span>
              <span className="text-red-500"> *</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                bidderFiles.length > 0
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
              }`}
              onClick={() => document.getElementById('bidder-input')?.click()}
            >
              {bidderFiles.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-green-700">
                    {bidderFiles.length} file{bidderFiles.length > 1 ? 's' : ''} selected
                  </p>
                  <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {bidderFiles.map((f, i) => (
                      <li key={i}>{f.name}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-2">Click to change</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Click to select bidder documents
                </p>
              )}
            </div>
            <input
              id="bidder-input"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt"
              className="hidden"
              onChange={(e) => {
                setBidderFiles(Array.from(e.target.files ?? []));
                setEvalError('');
              }}
            />
          </div>

          {/* Error */}
          {evalError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{evalError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
          >
            {evaluating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Evaluating bidder...
              </span>
            ) : (
              'Evaluate Bidder →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}