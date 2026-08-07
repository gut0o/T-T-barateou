/*
  T&T - CONFIGURAÇÃO DOS LINKS

  Troque SOMENTE os três links abaixo.
*/

const LINKS = {
  grupo1: "https://chat.whatsapp.com/COLOQUE-AQUI-O-LINK-DO-GRUPO-1",
  grupo2: "https://chat.whatsapp.com/COLOQUE-AQUI-O-LINK-DO-GRUPO-2",
  instagram: "https://instagram.com/COLOQUE-AQUI-O-USUARIO"
};

document.getElementById("grupo1").href = LINKS.grupo1;
document.getElementById("grupo2").href = LINKS.grupo2;
document.getElementById("instagram").href = LINKS.instagram;
document.getElementById("year").textContent = new Date().getFullYear();
