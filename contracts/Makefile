.PHONY: test build optimize clean

TOOLCHAIN ?= 1.89.0
WASM = target/wasm32-unknown-unknown/release/family_vault.wasm

test:
	cargo +$(TOOLCHAIN) test

build:
	cargo +$(TOOLCHAIN) build --release --target wasm32-unknown-unknown

optimize: build
	stellar contract optimize --wasm $(WASM)

clean:
	cargo clean
