"use client";

import React, { useState } from "react";
import { FileText, X, Pill, Plus, Trash2, Dumbbell, Lightbulb, Loader2, CheckCircle2 } from "lucide-react";
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
    <div className="fixed inset-0 z-50 bg-[#0B0C10]/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,0.4)] border border-slate-200 flex flex-col font-sans animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between z-10">
          <div>
            <h3 className="text-[17px] font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-800" /> Clinical
              Prescription
            </h3>
            <p className="text-[13px] text-slate-500 mt-0.5">
              This will automatically sync with the patient&apos;s recovery dashboard.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Medicines */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5" /> Medications
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
                className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Medication
              </button>
            </div>
            <div className="space-y-3">
              {medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group hover:border-slate-300 transition-colors"
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
                    className="w-[90%] bg-transparent border-b border-slate-200 pb-1 mb-4 text-[14px] font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {medicines.length === 0 && (
                <p className="text-[13px] text-slate-500 italic">
                  No medications added.
                </p>
              )}
            </div>
          </section>

          {/* Exercises */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" /> Prescribed Exercises
              </h4>
              <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {prescribedExercises.length} Exercises
              </span>
            </div>
            <div className="space-y-3">
              {prescribedExercises.map((ex, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group hover:border-slate-300 transition-colors"
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
                  <p className="font-semibold text-[14px] text-slate-800 mb-4 w-[90%]">
                    {ex.name}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
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
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Advice */}
          <section>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Clinical Notes & Tips
            </h4>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              rows={3}
              placeholder="Add specific notes for the patient..."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[14px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors mb-3 resize-none"
            />
            <div className="space-y-2">
              {healthyTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-lg text-[13px] text-slate-700 border border-slate-200"
                >
                  <span className="flex-1">• {tip}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setHealthyTips(healthyTips.filter((_, i) => i !== idx))
                    }
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newTipInput}
                  onChange={(e) => setNewTipInput(e.target.value)}
                  placeholder="Add another tip..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTipInput.trim()) {
                      e.preventDefault();
                      setHealthyTips([...healthyTips, newTipInput.trim()]);
                      setNewTipInput("");
                    }
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTipInput.trim()) {
                      setHealthyTips([...healthyTips, newTipInput.trim()]);
                      setNewTipInput("");
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-4 font-medium transition-colors text-[13px]"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 text-slate-700 rounded-xl h-11 font-medium hover:bg-slate-50 transition-colors text-[14px]"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-70 text-white rounded-xl h-11 font-medium flex items-center justify-center gap-2 transition-colors text-[14px]"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Publish & Synchronize
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
