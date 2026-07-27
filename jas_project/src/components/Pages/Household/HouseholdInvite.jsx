import { useState } from "react";
import { hapticError } from "../../../lib/security";
import { getUserFacingError } from "../../../lib/security";
import { getSupabaseClient } from "../../../lib/superbase";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import SheetModal from "../../ui/modals/Sheet_modal";
import FormField from "../../ui/form/Form_field.jsx";
import EmptyState from "../../ui/Empty_state";

function HouseholdInvite({
  household,
  members,
  joinModal,
  createModal,
  deleteModal,
  fetchHousehold,
  deleting,
  handleDelete,
}) {
  const { success: toastSuccess, error: toastError } = useGlassToast();
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Field validation states
  const [nameFieldState, setNameFieldState] = useState("idle");
  const [nameFieldError, setNameFieldError] = useState(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [codeFieldState, setCodeFieldState] = useState("idle");
  const [codeFieldError, setCodeFieldError] = useState(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Field validation
  const validateNameField = (value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) {
        setNameFieldState("error");
        setNameFieldError("Household name is required");
      } else {
        setNameFieldState("idle");
        setNameFieldError(null);
      }
      return;
    }
    if (trimmed.length >= 2 && trimmed.length <= 40) {
      setNameFieldState("valid");
      setNameFieldError(null);
    } else if (trimmed.length > 40) {
      setNameFieldState("error");
      setNameFieldError("Name too long (max 40)");
    } else {
      setNameFieldState("error");
      setNameFieldError("At least 2 characters");
    }
  };

  const validateCodeField = (value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) {
        setCodeFieldState("error");
        setCodeFieldError("Invite code is required");
      } else {
        setCodeFieldState("idle");
        setCodeFieldError(null);
      }
      return;
    }
    setCodeFieldState("valid");
    setCodeFieldError(null);
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    validateNameField(householdName, true);
    if (!householdName.trim() || householdName.trim().length < 2) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };

  const handleCodeBlur = () => {
    setCodeTouched(true);
    validateCodeField(joinCode, true);
    if (!joinCode.trim()) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };

  const handleNameChange = (e) => {
    const v = e.target.value;
    setHouseholdName(v);
    if (nameTouched) validateNameField(v);
  };

  const handleCodeChange = (e) => {
    const v = e.target.value;
    setJoinCode(v);
    if (codeTouched) validateCodeField(v);
  };

  // Create household
  const handleCreate = async () => {
    setNameTouched(true);
    if (!householdName.trim() || householdName.trim().length < 2) {
      validateNameField(householdName, true);
      setShakeKey((k) => k + 1);
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: hh, error: createError } = await supabase
        .rpc("create_household", {
          household_name: householdName.trim() || "Our Household",
        })
        .single();
      if (createError) throw createError;
      createModal.closeModal();
      toastSuccess(
        "Household created! Share the invite code with your partner.",
      );
      fetchHousehold();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setJoinLoading(false);
  };

  // Join household
  const handleJoin = async () => {
    setCodeTouched(true);
    if (!joinCode.trim()) {
      validateCodeField(joinCode, true);
      setShakeKey((k) => k + 1);
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: joinError } = await supabase.rpc("join_household", {
        invite_code_param: joinCode.trim(),
      });
      if (joinError) {
        if (joinError.message.includes("duplicate"))
          toastError("You're already in this household.");
        else if (joinError.message.includes("Invalid invite code"))
          toastError("Invalid invite code. Check and try again.");
        else throw joinError;
      } else {
        joinModal.closeModal();
        toastSuccess("Joined household!");
        fetchHousehold();
      }
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setJoinLoading(false);
  };

  const copyInviteCode = () => {
    if (household?.invite_code) {
      navigator.clipboard
        .writeText(household.invite_code)
        .then(() => toastSuccess("Invite code copied!"));
    }
  };

  const openCreateModal = () => {
    setNameTouched(false);
    setNameFieldState("idle");
    setNameFieldError(null);
    setHouseholdName("");
    createModal.openModal();
  };

  const openJoinModal = () => {
    setCodeTouched(false);
    setCodeFieldState("idle");
    setCodeFieldError(null);
    setJoinCode("");
    joinModal.openModal();
  };

  const closeCreateModal = () => {
    setNameTouched(false);
    setNameFieldState("idle");
    setNameFieldError(null);
    createModal.closeModal();
  };

  const closeJoinModal = () => {
    setCodeTouched(false);
    setCodeFieldState("idle");
    setCodeFieldError(null);
    joinModal.closeModal();
  };

  return (
    <>
      {/* No household empty state */}
      {!household && (
        <EmptyState
          className="household__empty animate-in animate-in--1"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="M9 22V12h6v10" />
              <path d="M12 5.5v.01" />
            </svg>
          }
          title="Set up your household"
          text="Create a household or join your partner's to track expenses, earnings, and savings together."
          action={
            <div className="household__setup-btns">
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreateModal}
              >
                Create household
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={openJoinModal}
              >
                Join with code
              </button>
            </div>
          }
        />
      )}

      {/* Invite + Delete buttons (when household exists) */}
      {household && (
        <div
          className="household__header-actions animate-in animate-in--1"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.4rem",
            marginBottom: "0.75rem",
          }}
        >
          <button
            type="button"
            className="household__invite-btn"
            onClick={copyInviteCode}
          >
            <span className="household__invite-icon">🔗</span>
            <span className="household__invite-code">
              {household.invite_code}
            </span>
          </button>
          <button
            type="button"
            className="household__delete-btn"
            onClick={() => deleteModal.openModal()}
            title="Delete household"
          >
            🗑
          </button>
        </div>
      )}

      {/* Member count */}
      {household && (
        <p
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.35)",
            marginBottom: "1rem",
          }}
        >
          {members.length} member{members.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Create Modal */}
      <SheetModal
        open={createModal.open}
        closing={createModal.closing}
        onClose={closeCreateModal}
        title="Create household"
      >
        <div className="household__form">
          <FormField
            label="Household name"
            error={nameFieldError}
            state={nameFieldState}
            showIndicator
            shake={nameFieldError ? shakeKey : 0}
          >
            <input
              type="text"
              value={householdName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              placeholder="Our Household"
              maxLength={40}
              autoFocus
            />
          </FormField>
          <p className="household__form-hint">
            You'll get an invite code to share with your partner.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeCreateModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={joinLoading || !householdName.trim()}
            >
              {joinLoading ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Join Modal */}
      <SheetModal
        open={joinModal.open}
        closing={joinModal.closing}
        onClose={closeJoinModal}
        title="Join household"
      >
        <div className="household__form">
          <FormField
            label="Invite code"
            error={codeFieldError}
            state={codeFieldState}
            showIndicator
            shake={codeFieldError ? shakeKey : 0}
          >
            <input
              type="text"
              value={joinCode}
              onChange={handleCodeChange}
              onBlur={handleCodeBlur}
              placeholder="Enter code"
              autoFocus
            />
          </FormField>
          <p className="household__form-hint">
            Ask your partner for the invite code from their Household page.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeJoinModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleJoin}
              disabled={joinLoading || !joinCode.trim()}
            >
              {joinLoading ? "Joining…" : "Join"}
            </button>
          </div>
        </div>
      </SheetModal>
    </>
  );
}

export default HouseholdInvite;
