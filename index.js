const MODAL_ID = "persona-plus-modal";

$(document).ready(() => {

    createModal();

    $(document).on("click", "[data-persona-manager]", function (e) {

        e.preventDefault();
        e.stopPropagation();

        openPersonaPlus();
    });

});

function openPersonaPlus(){

    $("#" + MODAL_ID).fadeIn(120);

}

function closePersonaPlus(){

    $("#" + MODAL_ID).fadeOut(120);

}

function createModal(){

    if($("#"+MODAL_ID).length) return;

    $("body").append(`

<div id="${MODAL_ID}" class="pp-overlay">

<div class="pp-window">

<div class="pp-header">

<h1>Persona</h1>

<button class="pp-close">

<i class="fa-solid fa-xmark"></i>

</button>

</div>

<div class="pp-toolbar">

<input
class="pp-search"
placeholder="Search Personas..."
>

<button class="pp-add">

<i class="fa-solid fa-plus"></i>

</button>

</div>

<div class="pp-current">

<h2>Current Persona</h2>

<div class="pp-current-card">

<div class="pp-avatar"></div>

<div>

<h3>Luna Lee</h3>

<p>Current Active Persona</p>

</div>

</div>

</div>

<div class="pp-grid">

</div>

</div>

</div>

`);

    $(".pp-close").on("click", closePersonaPlus);

    createDummyCards();

}

function createDummyCards(){

    const grid = $(".pp-grid");

    for(let i=0;i<18;i++){

        grid.append(`

<div class="pp-card">

<div class="pp-avatar"></div>

<h3>Persona ${i+1}</h3>

<p>Description</p>

<div class="pp-actions">

<button><i class="fa-solid fa-pen"></i></button>

<button><i class="fa-solid fa-folder"></i></button>

<button><i class="fa-solid fa-trash"></i></button>

</div>

</div>

`);

    }

}
