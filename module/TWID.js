import { SoundSystem } from "./SoundSys.js";

export class TWIDActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["TWID", "sheet", "actor"],
      template: "systems/TWID/templates/actor/actor-sheet.html",
      width: 650,
      height: 705,
      resizable: false
    });
  }

  getData() {
    const data = super.getData();
    data.system = data.actor.system;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Avoid duplicate listeners
    html.off("change", 'select[name^="system."]');
    html.off("click", ".roll-power");
    html.off("click", ".roll-species");
    html.off("click", ".roll-attribute");
    html.off("click", ".danger-increment");
    html.off("click", ".danger-decrement");

    html.on("click", ".danger-increment", async ev => {
      ev.preventDefault();
      const current = Number(this.actor.system.danger) || 0;
      await this.actor.update({ "system.danger": current + 1 });
    });

    html.on("click", ".danger-decrement", async ev => {
      ev.preventDefault();
      const current = Number(this.actor.system.danger) || 0;
      await this.actor.update({ "system.danger": Math.max(0, current - 1) });
    });

    // When species changes, attributes update automatically
    html.on("change", 'select[name="system.species"]', async ev => {
      const species = ev.currentTarget.value;

      const valuesBySpecies = {
        fox:      { clever: 2, fierce: 2, sly: 1, quick: 1 },
        cat:      { clever: 0, fierce: 1, sly: 3, quick: 2 },
        toad:     { clever: 1, fierce: 0, sly: 2, quick: 1 },
        spider:   { clever: 2, fierce: 0, sly: 3, quick: 1 },
        owl:      { clever: 3, fierce: 1, sly: 1, quick: 2 },
        hare:     { clever: 0, fierce: 0, sly: 2, quick: 3 },
        magpie:   { clever: 2, fierce: 1, sly: 1, quick: 2 },
        crow:     { clever: 2, fierce: 1, sly: 2, quick: 1 },
        dog:      { clever: 1, fierce: 3, sly: 0, quick: 1 },
        rat:      { clever: 1, fierce: 0, sly: 2, quick: 2 }
      };

      const newValues = valuesBySpecies[species];

      if (newValues) {
        await this.actor.update({
          "system.species": species,
          "system.clever": newValues.clever,
          "system.fierce": newValues.fierce,
          "system.sly": newValues.sly,
          "system.quick": newValues.quick
        });
      } else {
        await this.actor.update({ "system.species": "" });
      }

      this.render(false);
    });

    // Roll d10 when the power die button is clicked
    html.on("click", ".roll-power", async ev => {
      ev.preventDefault();

      const roll = new Roll("1d10");
      await roll.evaluate({ async: true });

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: "Rolling for random power..."
      });

      Hooks.once("diceSoNiceRollComplete", async () => {
        const powers = [
          "Unseen Hand.",
          "Conjure Light.",
          "Speak Human.",
          "Lock/Unlock, Open/Close.",
          "Conjure Dinner.",
          "Make Flame.",
          "Tidy, Clean and Mend.",
          "Plant Growth.",
          "Distract/Confuse.",
          "Make Book Read Itself Aloud."
        ];

        const chosenPower = powers[roll.total - 1];

        await this.actor.update({ "system.randomPower": chosenPower });

        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content:`<div class="power-revealed"><b>Your power is:</b> ${chosenPower}</div>`
        });

        this.render(false);
      });
    });

    // Roll d10 when the species die button is clicked
    html.on("click", ".roll-species", async ev => {
      ev.preventDefault();

      const roll = new Roll("1d10");
      await roll.evaluate({ async: true });

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: "Rolling for random species..."
      });

      Hooks.once("diceSoNiceRollComplete", async () => {
        const speciesList = [
          "fox", "cat", "toad", "spider",
          "owl", "hare", "magpie", "crow",
          "dog", "rat"
        ];

        const chosenSpecies = speciesList[roll.total - 1];

        const valuesBySpecies = {
          fox:      { clever: 2, fierce: 2, sly: 1, quick: 1 },
          cat:      { clever: 0, fierce: 1, sly: 3, quick: 2 },
          toad:     { clever: 1, fierce: 0, sly: 2, quick: 1 },
          spider:   { clever: 2, fierce: 0, sly: 3, quick: 1 },
          owl:      { clever: 3, fierce: 1, sly: 1, quick: 2 },
          hare:     { clever: 0, fierce: 0, sly: 2, quick: 3 },
          magpie:   { clever: 2, fierce: 1, sly: 1, quick: 2 },
          crow:     { clever: 2, fierce: 1, sly: 2, quick: 1 },
          dog:      { clever: 1, fierce: 3, sly: 0, quick: 1 },
          rat:      { clever: 1, fierce: 0, sly: 2, quick: 2 }
        };

        const newValues = valuesBySpecies[chosenSpecies];


        if (newValues) {
          await this.actor.update({
            "system.species": chosenSpecies,
            "system.clever": newValues.clever,
            "system.fierce": newValues.fierce,
            "system.sly": newValues.sly,
            "system.quick": newValues.quick
          });
        }

        // Update the select in the form
        const speciesSelect = html.find('select[name="system.species"]');
        speciesSelect.val(chosenSpecies);

        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div class="species-revealed"><b>Your species is:</b> ${chosenSpecies}</div>`
        });

        this.render(false);
      });
    });


    // Attribute rolls when clicking the name
    html.on("click", ".roll-attribute", async ev => {
      ev.preventDefault();

      const container = ev.currentTarget.closest(".attr");
      const key = container.dataset.attr; // "strength", "speed", etc.
      const value = parseInt(container.querySelector(".attr-value").textContent);

      // Build the roll with the attribute value added
      const roll = new Roll(`1d10 + ${value}`);
      await roll.evaluate({ async: true });

      // Send to chat as an official roll so it appears in Dice Tray
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `<b>${key}</b> roll`,
        rollMode: "roll" // Ensure it's a normal roll
      });

      // Play the character's sound if present
      SoundSystem.playActorSound(this.actor);
    });

    html.on("click", ".roll-magic", async ev => {
      ev.preventDefault();

      // Take the chosen power from the actor
      const chosenPower = this.actor.system.randomPower || "none";

      const roll = new Roll("1d10");
      await roll.evaluate({ async: true });

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Magic: ${chosenPower}`,
        rollMode: "roll"
      });
    });

    // Voice recording and playback system
    SoundSystem.activateListeners(html, this.actor);
  }
}

Hooks.once("init", function() {
  console.log("TWID | Initializing The Witch is Dead system");
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("TWID", TWIDActorSheet, { makeDefault: true });

  // Initialize the socket listener for audio
  SoundSystem.initializeSocketListener();

// in module/TWID.js or your main JS
Hooks.once('ready', () => {
  // Load chat CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'systems/TWID/css/chat-message.css';
  document.head.appendChild(link);
});

Hooks.on("renderChatMessage", (message, html, data) => {

  const diceTotal = html.find(".dice-total");

  diceTotal.on("click", function () {

    const roll = $(this).closest(".dice-roll");

    roll.toggleClass("show-formula");

  });

});

});
