set -eu
: "${REPRO_ROOT:?Set REPRO_ROOT to an empty temporary directory}"
mkdir -p "$REPRO_ROOT/harness"
git clone https://github.com/SawyerHood/bb-plugin-t3sidebar.git "$REPRO_ROOT/t3sidebar"
git -C "$REPRO_ROOT/t3sidebar" checkout --detach 9eecc40d9b2b5d1948c2a23d13efcf3e0ed84b0e
git clone https://github.com/yusuf8834/bb-sidebar.git "$REPRO_ROOT/bb-sidebar"
git -C "$REPRO_ROOT/bb-sidebar" checkout --detach 77e36967ff2e86d3c43a22ec1a68baedc6db05d2
git clone https://github.com/smsunarto/bb-plugins.git "$REPRO_ROOT/bb-plugins"
git -C "$REPRO_ROOT/bb-plugins" checkout --detach c1fe661c414f12ff16106642338f37c45b01285d
git clone https://github.com/wy3z/bb-plugin-thread-inbox.git "$REPRO_ROOT/bb-plugin-thread-inbox"
git -C "$REPRO_ROOT/bb-plugin-thread-inbox" checkout --detach ed3a6874a971c33d8ae369d59119c34cf17e7924
git clone https://github.com/get-bb/bb.git "$REPRO_ROOT/base"
git -C "$REPRO_ROOT/base" checkout --detach 1ab96a0ce28c28774c33b169c4dfb8df0ab46c58
