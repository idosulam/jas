import { useState } from "react";
import { haptic_error } from "../../../Lib/Security";
import { get_user_facing_error } from "../../../Lib/Security";
import { get_supabase_client } from "../../../Lib/Superbase";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import SheetModal from "../../UI/Modals/Sheet_modal";
import FormField from "../../UI/Form/Form_field.jsx";
import EmptyState from "../../UI/Empty_state";

function HouseholdInvite({
  household,
  members,
  joinModal,
  createModal,
  delete_modal,
  fetch_household,
  deleting,
  handle_delete,
}) {
  const { success: toast_success, error: toast_error } = use_glass_toast();
  const [household_name, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Field validation states
  const [nameFieldState, setNameFieldState] = useState("idle");
  const [nameFieldError, setNameFieldError] = useState(null);
  const [name_touched, set_name_touched] = useState(false);
  const [codeFieldState, setCodeFieldState] = useState("idle");
  const [codeFieldError, setCodeFieldError] = useState(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [shake_key, set_shake_key] = useState(0);

  // Field validation
  const validate_name_field = (value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
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

  const validateCodeField = (value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
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

  const handle_name_blur = () => {
    set_name_touched(true);
    validate_name_field(household_name, true);
    if (!household_name.trim() || household_name.trim().length < 2) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const handleCodeBlur = () => {
    setCodeTouched(true);
    validateCodeField(joinCode, true);
    if (!joinCode.trim()) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const handle_name_change = (e) => {
    const v = e.target.value;
    setHouseholdName(v);
    if (name_touched) validate_name_field(v);
  };

  const handleCodeChange = (e) => {
    const v = e.target.value;
    setJoinCode(v);
    if (codeTouched) validateCodeField(v);
  };

  // Create household
  const handleCreate = async () => {
    set_name_touched(true);
    if (!household_name.trim() || household_name.trim().length < 2) {
      validate_name_field(household_name, true);
      set_shake_key((k) => k + 1);
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = get_supabase_client();
      const { data: hh, error: createError } = await supabase
        .rpc("create_household", {
          household_name: household_name.trim() || "Our Household",
        })
        .single();
      if (createError) throw createError;
      createModal.close_modal();
      toast_success(
        "Household created! Share the invite code with your partner.",
      );
      fetch_household();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setJoinLoading(false);
  };

  // Join household
  const handleJoin = async () => {
    setCodeTouched(true);
    if (!joinCode.trim()) {
      validateCodeField(joinCode, true);
      set_shake_key((k) => k + 1);
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = get_supabase_client();
      const { error: joinError } = await supabase.rpc("join_household", {
        invite_code_param: joinCode.trim(),
      });
      if (joinError) {
        if (joinError.message.includes("duplicate"))
          toast_error("You're already in this household.");
        else if (joinError.message.includes("Invalid invite code"))
          toast_error("Invalid invite code. Check and try again.");
        else throw joinError;
      } else {
        joinModal.close_modal();
        toast_success("Joined household!");
        fetch_household();
      }
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setJoinLoading(false);
  };

  const copyInviteCode = () => {
    if (household?.invite_code) {
      navigator.clipboard
        .writeText(household.invite_code)
        .then(() => toast_success("Invite code copied!"));
    }
  };

  const openCreateModal = () => {
    set_name_touched(false);
    setNameFieldState("idle");
    setNameFieldError(null);
    setHouseholdName("");
    createModal.open_modal();
  };

  const openJoinModal = () => {
    setCodeTouched(false);
    setCodeFieldState("idle");
    setCodeFieldError(null);
    setJoinCode("");
    joinModal.open_modal();
  };

  const closeCreateModal = () => {
    set_name_touched(false);
    setNameFieldState("idle");
    setNameFieldError(null);
    createModal.close_modal();
  };

  const closeJoinModal = () => {
    setCodeTouched(false);
    setCodeFieldState("idle");
    setCodeFieldError(null);
    joinModal.close_modal();
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
            onClick={() => delete_modal.open_modal()}
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
            show_indicator
            shake={nameFieldError ? shake_key : 0}
          >
            <input
              type="text"
              value={household_name}
              onChange={handle_name_change}
              onBlur={handle_name_blur}
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
              disabled={joinLoading || !household_name.trim()}
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
            show_indicator
            shake={codeFieldError ? shake_key : 0}
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
