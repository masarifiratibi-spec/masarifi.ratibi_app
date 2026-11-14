#include "fabric-test-types.h"
#include <barrier>
#include <iostream>
#include <thread>

// Access to lifecycle entry points only; the compiled implementation is unchanged.
#define private public
#include "NativeProxy.h"
#undef private

using namespace facebook;

static void require(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}

struct Fixture {
  std::shared_ptr<jni::JavaProxy> receiver = std::make_shared<jni::JavaProxy>();
  std::shared_ptr<react::JFabricUIManager::javaobject> fabric =
      std::make_shared<react::JFabricUIManager::javaobject>();
  rnscreens::NativeProxy proxy{jni::Ref<jni::JavaProxy>(receiver)};

  const react::MountingCoordinator &coordinator() const {
    return *fabric->binding->scheduler->manager->registry.tree.coordinator;
  }

  void install() { proxy.nativeAddMutationsListener(fabric); }

  void pull() const {
    for (const auto &weak : coordinator().delegates) {
      if (auto delegate = weak.lock(); delegate && delegate->shouldOverridePullTransaction()) {
        react::ShadowViewMutationList mutations{
            {react::ShadowViewMutation::Type::Remove, {"RNSScreen", 17}},
            {react::ShadowViewMutation::Type::Remove, {"OtherView", 18}},
            {react::ShadowViewMutation::Type::Remove, {nullptr, 19}},
            {react::ShadowViewMutation::Type::Create, {"RNSScreen", 20}}};
        auto transaction = delegate->pullTransaction(7, 31, {}, mutations);
        require(transaction && transaction->surfaceId == 7 && transaction->number == 31,
                "TRANSACTION_IDENTITY_CHANGED");
        require(transaction->mutations.size() == mutations.size(), "MUTATIONS_TRUNCATED");
        for (size_t i = 0; i < mutations.size(); ++i) {
          require(transaction->mutations[i].type == mutations[i].type &&
                  transaction->mutations[i].oldChildShadowView.tag == mutations[i].oldChildShadowView.tag &&
                  transaction->mutations[i].oldChildShadowView.componentName == mutations[i].oldChildShadowView.componentName,
                  "MUTATION_CHANGED");
        }
      }
    }
  }
};

int main() {
  try {
    {
      Fixture fixture;
      fixture.install();
      fixture.pull();
      require(fixture.receiver->removedTags == std::vector<int>{17}, "REMOVAL_NOTIFICATION_CHANGED");
      fixture.proxy.invalidateNative();
      fixture.pull();
      require(fixture.receiver->removedTags == std::vector<int>{17}, "INVALIDATED_CALLBACK_FIRED");
    }
    {
      Fixture fixture;
      fixture.proxy.invalidateNative();
      fixture.install();
      fixture.pull();
      require(fixture.receiver->removedTags.empty(), "INVALIDATED_PROXY_REARMED");
    }
    {
      Fixture oldOwner, newOwner;
      oldOwner.install();
      newOwner.install();
      oldOwner.proxy.invalidateNative();
      oldOwner.install();
      newOwner.pull();
      require(newOwner.receiver->removedTags == std::vector<int>{17}, "NEW_OWNER_DISARMED_OR_DUPLICATED");
      require(oldOwner.receiver->removedTags.empty(), "OLD_OWNER_NOTIFIED");
      newOwner.proxy.invalidateNative();
      newOwner.pull();
    }
    for (int attempt = 0; attempt < 200; ++attempt) {
      Fixture fixture;
      std::barrier start(3);
      std::thread first([&] { start.arrive_and_wait(); fixture.install(); });
      std::thread second([&] { start.arrive_and_wait(); fixture.install(); });
      start.arrive_and_wait();
      first.join(); second.join();
      require(fixture.coordinator().delegates.size() == 1, "DUPLICATE_COORDINATOR_REGISTRATION");
      fixture.pull();
      require(fixture.receiver->removedTags == std::vector<int>{17}, "CONCURRENT_INSTALL_CORRUPTED");
      fixture.proxy.invalidateNative();
      fixture.pull();
    }
    for (int attempt = 0; attempt < 200; ++attempt) {
      Fixture fixture;
      std::barrier start(3);
      std::thread install([&] { start.arrive_and_wait(); fixture.install(); });
      std::thread invalidate([&] { start.arrive_and_wait(); fixture.proxy.invalidateNative(); });
      start.arrive_and_wait();
      install.join(); invalidate.join();
      fixture.pull();
      require(fixture.receiver->removedTags.empty(), "CONCURRENT_TEARDOWN_REARMED");
    }
    std::cout << "PASS: removal/filtering, transaction parity, teardown, stale-owner token, "
                 "200 double installs, 200 install/invalidate races\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
