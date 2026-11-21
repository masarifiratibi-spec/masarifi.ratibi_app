#pragma once

// Only the JNI/renderer boundaries are fixtures. The test compiles the real
// NativeProxy and RNSScreenRemovalListener sources, without an app or server.
#include <algorithm>
#include <atomic>
#include <cstring>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <ranges>
#include <stdexcept>
#include <vector>

using jint = int;

namespace facebook::jni {
template <typename T> class Ref {
 public:
  Ref() = default;
  Ref(std::shared_ptr<T> object) : object_(std::move(object)) {}
  T *operator->() const {
    if (!object_) throw std::runtime_error("NULL_JNI_REFERENCE");
    return object_.get();
  }
  explicit operator bool() const { return bool(object_); }
  Ref &operator=(std::nullptr_t) { object_.reset(); return *this; }
 private:
  std::shared_ptr<T> object_;
};
template <typename T> using alias_ref = Ref<T>;
template <typename T> using global_ref = Ref<T>;
template <typename T> using local_ref = Ref<T>;
template <typename T> Ref<T> make_global(Ref<T> object) { return object; }

struct JavaProxy;
struct JavaMethod {
  void operator()(Ref<JavaProxy> receiver, int tag) const;
};
struct JavaClass {
  template <typename Signature> JavaMethod getMethod(const char *) { return {}; }
};
struct JavaProxy {
  JavaClass type;
  std::vector<int> removedTags;
  std::mutex mutex;
  JavaClass *getClass() { return &type; }
};
inline void JavaMethod::operator()(Ref<JavaProxy> receiver, int tag) const {
  std::lock_guard lock(receiver->mutex);
  receiver->removedTags.push_back(tag);
}
struct HybridBase {};
template <typename T> struct HybridClass {
  using javaobject = JavaProxy;
  using jhybridobject = JavaProxy;
  using jhybriddata = int;
  template <typename Method> static int makeNativeMethod(const char *, Method) { return 0; }
  static void registerHybrid(std::initializer_list<int>) {}
  static Ref<int> makeCxxInstance(Ref<JavaProxy>) { return {}; }
};
} // namespace facebook::jni

namespace facebook::react {
using SurfaceId = int;
struct TransactionTelemetry {};
struct ShadowView { const char *componentName; int tag; };
struct ShadowViewMutation {
  enum class Type { Remove, Create };
  Type type;
  ShadowView oldChildShadowView;
};
using ShadowViewMutationList = std::vector<ShadowViewMutation>;
struct MountingTransaction {
  using Number = int;
  SurfaceId surfaceId;
  Number number;
  ShadowViewMutationList mutations;
  TransactionTelemetry telemetry;
};
struct MountingOverrideDelegate {
  virtual bool shouldOverridePullTransaction() const = 0;
  virtual std::optional<MountingTransaction> pullTransaction(
      SurfaceId, MountingTransaction::Number, const TransactionTelemetry &,
      ShadowViewMutationList) const = 0;
  virtual ~MountingOverrideDelegate() = default;
};
struct MountingCoordinator {
  mutable std::vector<std::weak_ptr<const MountingOverrideDelegate>> delegates;
  void setMountingOverrideDelegate(std::weak_ptr<const MountingOverrideDelegate> delegate) const {
    delegates.push_back(delegate);
  }
};
struct ShadowTree {
  std::shared_ptr<MountingCoordinator> coordinator = std::make_shared<MountingCoordinator>();
  std::shared_ptr<const MountingCoordinator> getMountingCoordinator() const { return coordinator; }
};
struct ShadowTreeRegistry {
  ShadowTree tree;
  template <typename Callback> void enumerate(Callback callback) const {
    bool stop = false;
    callback(tree, stop);
  }
};
struct UIManager {
  ShadowTreeRegistry registry;
  const ShadowTreeRegistry &getShadowTreeRegistry() const { return registry; }
};
struct Scheduler {
  std::shared_ptr<UIManager> manager = std::make_shared<UIManager>();
  std::shared_ptr<UIManager> getUIManager() const { return manager; }
};
struct Binding {
  std::shared_ptr<Scheduler> scheduler = std::make_shared<Scheduler>();
  std::shared_ptr<Scheduler> getScheduler() const { return scheduler; }
};
struct JFabricUIManager {
  struct javaobject {
    std::shared_ptr<Binding> binding = std::make_shared<Binding>();
    std::shared_ptr<Binding> getBinding() const { return binding; }
  };
};
} // namespace facebook::react

// fbjni provides this as a registration macro; registration is not exercised.
#define makeNativeMethod(name, method) 0
