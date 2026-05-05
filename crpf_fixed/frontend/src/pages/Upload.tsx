import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const [tenderFile, setTenderFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!tenderFile) {
      setError('Please select a tender document first.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', tenderFile);

      const { data } = await axios.post(
        'http://localhost:8000/api/tender/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Save criteria to sessionStorage so Review page can read them
      sessionStorage.setItem(`criteria_${data.run_id}`, JSON.stringify(data.criteria));

      navigate(`/review/${data.run_id}`);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Upload failed. Make sure the backend is running on port 8000.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-purple-950 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">

        {/* Header */}
        <div className="mb-8">
          <span className="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-widest uppercase">
            CRPF · Government Procurement
          </span>
          <h1 className="text-3xl font-bold text-gray-900">Tender Evaluation</h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-powered eligibility analysis for bidder submissions
          </p>
        </div>

        {/* Tender upload */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tender Document <span className="text-red-500">*</span>
          </label>
          <div
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              tenderFile
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
            }`}
            onClick={() => document.getElementById('tender-input')?.click()}
          >
            {tenderFile ? (
              <div>
                <p className="text-sm font-medium text-purple-700">{tenderFile.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(tenderFile.size / 1024).toFixed(1)} KB · Click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Click to upload tender PDF</p>
                <p className="text-xs text-gray-400 mt-1">PDF files only</p>
              </div>
            )}
          </div>
          <input
            id="tender-input"
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={(e) => {
              setTenderFile(e.target.files?.[0] || null);
              setError('');
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !tenderFile}
          className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Extracting criteria...
            </span>
          ) : (
            'Upload & Extract Criteria →'
          )}
        </button>

        {/* Info note */}
        <p className="text-xs text-gray-400 text-center mt-4">
          The system will automatically extract eligibility criteria from the tender document.
        </p>
      </div>
    </div>
  );
}