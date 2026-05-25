export class SoundSystem {
  static currentAudio = null;

  /**
   * Helper to play audio, stopping any other audio that was playing.
   * @param {string} audioData - The audio data as base64.
   * @private
   */
  static _playAudio(audioData) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioData);
    this.currentAudio = audio;
    audio.play().catch(e => console.error("TWID | Error playing audio", e));
  }

  // -----------------------------
  // Activate listeners for the sheet
  // -----------------------------
  static activateListeners(html, actor) {
    const recordButton = html.find(".record-voice");
    const playButton = html.find(".play-local-voice");
    const deleteButton = html.find(".delete-voice");

    recordButton.on("click", ev => this.recordVoice(ev, actor, playButton, deleteButton));
    playButton.on("click", ev => this.playLocalVoice(ev, actor));
    deleteButton.on("click", ev => this.deleteVoice(ev, actor, playButton, deleteButton));

    // Show buttons if audio already exists
    const voiceData = actor.getFlag("TWID", "voiceData");
    if (voiceData) {
      playButton.show();
      deleteButton.show();
    } else {
      playButton.hide();
      deleteButton.hide();
    }

    // Activate microphone settings
    this.activateMicSettings(html, actor);
  }

  // -----------------------------
  // Play the actor's local audio
  // -----------------------------
  static playLocalVoice(ev, actor) {
    ev.preventDefault();
    const voiceData = actor.getFlag("TWID", "voiceData");
    if (voiceData) {
      this._playAudio(voiceData);
    } else {
      ui.notifications.warn("No saved audio to play.");
    }
  }

  // -----------------------------
  // Delete the actor's audio
  // -----------------------------
  static async deleteVoice(ev, actor, playButton, deleteButton) {
    ev.preventDefault();
    await actor.unsetFlag("TWID", "voiceData");
    playButton.hide();
    deleteButton.hide();
    ui.notifications.info("Character audio deleted.");
  }

  // -----------------------------
  // Record audio
  // -----------------------------
  static async recordVoice(ev, actor, playButton, deleteButton) {
    const button = $(ev.currentTarget);
    if (button.hasClass("recording")) return;

    if (!window.MediaRecorder) return ui.notifications.error("Your browser does not support audio recording.");

    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/mp4'
    ];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) return ui.notifications.error("No compatible recording format.");

    try {
      // Get selected microphone
      const micId = await actor.getFlag("TWID", "voiceMicId");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micId ? { deviceId: { exact: micId } } : true
      });

      const recorder = new MediaRecorder(stream, { mimeType });
      const audioChunks = [];

      recorder.ondataavailable = event => audioChunks.push(event.data);

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        button.removeClass("recording").html('<i class="fas fa-microphone"></i> Record');

        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = reader.result;
          await actor.setFlag("TWID", "voiceData", base64String);
          playButton.show();
          deleteButton.show();
          ui.notifications.info("Voice recorded and saved to the character.");
        };
      };

      recorder.onerror = event => {
        console.error("TWID | MediaRecorder error:", event.error);
        ui.notifications.error("An error occurred during recording.");
        stream.getTracks().forEach(track => track.stop());
        button.removeClass("recording").html('<i class="fas fa-microphone"></i> Record');
      };

      button.addClass("recording").html('<i class="fas fa-microphone-slash"></i>');
      recorder.start();

      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 2000);

    } catch (err) {
      console.error("TWID | Error accessing microphone:", err);
      ui.notifications.error("Could not access the microphone. Check the permissions in your browser.");
      button.removeClass("recording").html('<i class="fas fa-microphone"></i> Record');
    }
  }

  // -----------------------------
  // Play audio to all players
  // -----------------------------
  static playActorSound(actor) {
    const voiceData = actor.getFlag("TWID", "voiceData");
    if (voiceData) {
      this._playAudio(voiceData);
      game.socket.emit('system.TWID', { audioData: voiceData });
    }
  }

  static initializeSocketListener() {
    game.socket.on("system.TWID", ({ audioData }) => this._playAudio(audioData));
  }

  // -----------------------------
  // Microphone Settings
  // -----------------------------
  static activateMicSettings(html, actor) {
    let modal = html.find(".voice-settings-modal");
    if (!modal.length) {
      const modalHtml = `
      <div class="voice-settings-modal" style="display:none;">
        <div class="voice-settings-content">
          <h3>Microphone Settings</h3>
          <label for="voice-input">Select the microphone:</label>
          <select id="voice-input"></select>
          <div class="modal-buttons">
            <button class="save-voice-settings">Save</button>
            <button class="close-voice-settings">Cancel</button>
          </div>
        </div>
      </div>`;
      html.append(modalHtml);
      modal = html.find(".voice-settings-modal");
    }

    const settingsBtn = html.find(".settings-voice");

    settingsBtn.off("click").on("click", async () => {
      modal.show();
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === "audioinput");

      const micSelect = modal.find("#voice-input");
      micSelect.empty();

      mics.forEach((mic, index) => {
        const option = `<option value="${mic.deviceId}">${mic.label || `Microphone ${index+1}`}</option>`;
        micSelect.append(option);
      });

      const selectedMic = await actor.getFlag("TWID", "voiceMicId");
      if (selectedMic) micSelect.val(selectedMic);
    });

    modal.find(".close-voice-settings").off("click").on("click", () => modal.hide());

    modal.find(".save-voice-settings").off("click").on("click", async () => {
      const micSelect = modal.find("#voice-input");
      const selectedMicId = micSelect.val();
      await actor.setFlag("TWID", "voiceMicId", selectedMicId);
      ui.notifications.info("Selected microphone saved to the character.");
      modal.hide();
    });
  }
}
