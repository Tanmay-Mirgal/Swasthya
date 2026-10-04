"use client";

import React, { useState } from "react";
import { FileText, X, Pill, Plus, Trash2, Dumbbell, Lightbulb, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PrescriptionMedicine, PrescriptionExercise } from "@/types/consultation";

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicines: PrescriptionMedicine[];
  setMedicines: React.Dispatch<React.SetStateAction<PrescriptionMedicine[]>>;
  prescribedExercises: PrescriptionExercise[];
  setPrescribedExercises: React.Dispatch<React.SetStateAction<PrescriptionExercise[]>>;
  healthyTips: string[];
  setHealthyTips: React.Dispatch<React.SetStateAction<string[]>>;
  doctorNotes: string;
  setDoctorNotes: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
  submitting: boolean;
}

export default function PrescriptionModal({
  isOpen,
  onClose,
  medicines,
  setMedicines,
  prescribedExercises,
  setPrescribedExercises,
  healthyTips,
  setHealthyTips,
  doctorNotes,
  setDoctorNotes,
  onSubmit,
  submitting,
}: PrescriptionModalProps) {
  const [newTipInput, setNewTipInput] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col font-sans animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" /> Clinical
              Prescription
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              This will automatically sync with the patient&apos;s recovery
              dashboard.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Medicines */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-600" /> Medications
              </h4>
              <button
                type="button"
                onClick={() =>
                  setMedicines([
                    ...medicines,
                    {
                      name: "",
                      dosage: "1 tablet",
                      frequency: "Daily",
                      duration: "5 days",
                      instructions: "",
                    },
                  ])
                }
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setMedicines(medicines.filter((_, i) => i !== idx))
                    }
                    className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={med.name}
                    onChange={(e) => {
                      const u = [...medicines];
                      u[idx].name = e.target.value;
                      setMedicines(u);
                    }}
                    placeholder="Medication name..."
                    className="w-[90%] bg-transparent border-b border-slate-200 pb-1 mb-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Dosage
                      </label>
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => {
                          const u = [...medicines];
                          u[idx].dosage = e.target.value;
                          setMedicines(u);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Frequency
                      </label>
                      <input
                        type="text"
                        value={med.frequency}
                        onChange={(e) => {
                          const u = [...medicines];
                          u[idx].frequency = e.target.value;
                          setMedicines(u);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={med.duration}
                        onChange={(e) => {
                          const u = [...medicines];
                          u[idx].duration = e.target.value;
                          setMedicines(u);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {medicines.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  No medications added.
                </p>
              )}
            </div>
          </section>

          {/* Exercises */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-600" /> Prescribed
                Exercises
              </h4>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                {prescribedExercises.length} Syncing
              </span>
            </div>
            <div className="space-y-3">
              {prescribedExercises.map((ex, idx) => (
                <div
                  key={idx}
                  className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 relative group"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setPrescribedExercises(
                        prescribedExercises.filter((_, i) => i !== idx)
                      )
                    }
                    className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <p className="font-bold text-sm text-slate-800 mb-3 w-[90%]">
                    {ex.name}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Sets
                      </label>
                      <input
                        type="number"
                        value={ex.sets}
                        onChange={(e) => {
                          const u = [...prescribedExercises];
                          u[idx].sets = parseInt(e.target.value) || 1;
                          setPrescribedExercises(u);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Reps
                      </label>
                      <input
                        type="number"
                        value={ex.reps}
                        onChange={(e) => {
                          const u = [...prescribedExercises];
                          u[idx].reps = parseInt(e.target.value) || 1;
                          setPrescribedExercises(u);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Frequency
                      </label>
                      <input
                        type="text"
                        value={ex.frequency}
                        onChange={(e) => {
                          const u = [...prescribedExercises];
                          u[idx].frequency = e.target.value;
                          setPrescribedExercises(u);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Advice */}
          <section>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" /> Clinical Notes &
              Tips
            </h4>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              rows={3}
              placeholder="Add specific notes for the patient..."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3"
            />
            <div className="space-y-2">
              {healthyTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg text-xs text-slate-700 border border-slate-100"
                >
                  <span className="flex-1">• {tip}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setHealthyTips(healthyTips.filter((_, i) => i !== idx))
                    }
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newTipInput}
                  onChange={(e) => setNewTipInput(e.target.value)}
                  placeholder="Add another tip..."
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (newTipInput.trim()) {
                      setHealthyTips([...healthyTips, newTipInput.trim()]);
                      setNewTipInput("");
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-4 h-[34px] text-xs font-semibold"
                >
                  Add
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 p-6 flex gap-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 bg-white border-slate-200 text-slate-700 rounded-xl h-12 font-bold hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> Publish & Synchronize
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
