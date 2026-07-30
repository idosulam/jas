import { useState } from "react";
import { Haptic_error } from "../../../Lib/Security";
import { Get_user_facing_error } from "../../../Lib/Security";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import Sheet_modal from "../../UI/Modals/Sheet_modal";
import Form_field from "../../UI/Form/Form_field.jsx";
import Empty_state from "../../UI/Empty_state";

function Household_invite({
  household,
  members,
  joinModal,
  createModal,
  Delete_modal,
  Fetch_household,
  Deleting,
  Handle_delete,
}) {
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();
  const [Household_name, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Field validation states
  const [nameFieldState, setNameFieldState] = useState("idle");
  const [nameFieldError, setNameFieldError] = useState(null);
  const [name_touched, Set_name_touched] = useState(false);
  const [codeFieldState, setCodeFieldState] = useState("idle");
  const [codeFieldError, setCodeFieldError] = useState(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [Shake_key, Set_shake_key] = useState(0);

  // Field validation
  const Validate_name_field = (value, is_blur = false) => {
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

  const Handle_name_blur = () => {
    Set_name_touched(true);
    Validate_name_field(Household_name, true);
    if (!Household_name.trim() || Household_name.trim().length < 2) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const handleCodeBlur = () => {
    setCodeTouched(true);
    validateCodeField(joinCode, true);
    if (!joinCode.trim()) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const Handle_name_change = (e) => {
    const v = e.target.value;
    setHouseholdName(v);
    if (name_touched) Validate_name_field(v);
  };

  const handleCodeChange = (e) => {
    const v = e.target.value;
    setJoinCode(v);
    if (codeTouched) validateCodeField(v);
  };

  // Create household
  const handleCreate = async () => {
    Set_name_touched(true);
    if (!Household_name.trim() || Household_name.trim().length < 2) {
      Validate_name_field(Household_name, true);
      Set_shake_key((k) => k + 1);
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = Get_supabase_client();
      const { data: hh, error: createError } = await supabase
        .rpc("create_household", {
          Household_name: Household_name.trim() || "Our Household",
        })
        .single();
      if (createError) throw createError;
      createModal.close_modal();
      Toast_success(
        "Household created! Share the invite code with your partner.",
      );
      Fetch_household();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
    setJoinLoading(false);
  };

  // Join household
  const handleJoin = async () => {
    setCodeTouched(true);
    if (!joinCode.trim()) {
      validateCodeField(joinCode, true);
      Set_shake_key((k) => k + 1);
      return;
    }
    setJoinLoading(true);
    try {
      const supabase = Get_supabase_client();
      const { error: joinError } = await supabase.rpc("join_household", {
        invite_code_param: joinCode.trim(),
      });
      if (joinError) {
        if (joinError.message.includes("duplicate"))
          Toast_error("You're already in this household.");
        else if (joinError.message.includes("Invalid invite code"))
          Toast_error("Invalid invite code. Check and try again.");
        else throw joinError;
      } else {
        joinModal.close_modal();
        Toast_success("Joined household!");
        Fetch_household();
      }
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
    setJoinLoading(false);
  };

  const copyInviteCode = () => {
    if (household?.Invite_code) {
      navigator.clipboard
        .writeText(household.Invite_code)
        .then(() => Toast_success("Invite code copied!"));
    }
  };

  const openCreateModal = () => {
    Set_name_touched(false);
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
    Set_name_touched(false);
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
        <Empty_state
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
              {household.Invite_code}
            </span>
          </button>
          <button
            type="button"
            className="household__delete-btn"
            onClick={() => Delete_modal.open_modal()}
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
      <Sheet_modal
        open={createModal.open}
        closing={createModal.closing}
        onClose={closeCreateModal}
        title="Create household"
      >
        <div className="household__form">
          <Form_field
            label="Household name"
            error={nameFieldError}
            state={nameFieldState}
            show_indicator
            shake={nameFieldError ? Shake_key : 0}
          >
            <input
              type="text"
              value={Household_name}
              onChange={Handle_name_change}
              onBlur={Handle_name_blur}
              placeholder="Our Household"
              maxLength={40}
              autoFocus
            />
          </Form_field>
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
              disabled={joinLoading || !Household_name.trim()}
            >
              {joinLoading ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </Sheet_modal>

      {/* Join Modal */}
      <Sheet_modal
        open={joinModal.open}
        closing={joinModal.closing}
        onClose={closeJoinModal}
        title="Join household"
      >
        <div className="household__form">
          <Form_field
            label="Invite code"
            error={codeFieldError}
            state={codeFieldState}
            show_indicator
            shake={codeFieldError ? Shake_key : 0}
          >
            <input
              type="text"
              value={joinCode}
              onChange={handleCodeChange}
              onBlur={handleCodeBlur}
              placeholder="Enter code"
              autoFocus
            />
          </Form_field>
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
      </Sheet_modal>
    </>
  );
}

export default Household_invite;
