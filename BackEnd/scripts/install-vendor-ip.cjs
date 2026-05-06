"use strict"

const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const vendor = path.join(root, "vendor", "ip")
const target = path.join(root, "node_modules", "ip")
const weriftNested = path.join(root, "node_modules", "werift", "node_modules", "ip")

if (!fs.existsSync(vendor)) {
  console.error(
    "[install-vendor-ip] Pasta ausente: vendor/ip. Inclua BackEnd/vendor/ip no deploy (git pull).",
  )
  process.exit(1)
}

function copyInto(dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(vendor, dest, { recursive: true })
}

copyInto(target)

if (fs.existsSync(path.join(root, "node_modules", "werift"))) {
  try {
    copyInto(weriftNested)
  } catch (e) {
    console.warn("[install-vendor-ip] Aviso ao copiar para werift/node_modules/ip:", e.message)
  }
}

console.log("[install-vendor-ip] OK: vendor/ip copiado para node_modules/ip")
