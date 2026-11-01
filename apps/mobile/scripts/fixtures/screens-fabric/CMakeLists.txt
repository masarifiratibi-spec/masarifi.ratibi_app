cmake_minimum_required(VERSION 3.22)
project(screens_fabric_lifecycle LANGUAGES CXX)

if(NOT DEFINED SCREENS_ROOT)
  message(FATAL_ERROR "SCREENS_ROOT must identify the native sources under test")
endif()

# Renderer/JNI boundary fixtures keep this executable independent of app data.
foreach(header fbjni/fbjni.h react/fabric/JFabricUIManager.h react/fabric/Binding.h
    react/renderer/scheduler/Scheduler.h
    react/renderer/componentregistry/ComponentDescriptorFactory.h
    react/renderer/mounting/MountingOverrideDelegate.h
    react/renderer/mounting/ShadowView.h
    react/renderer/mounting/ShadowViewMutation.h)
  get_filename_component(header_dir "${CMAKE_CURRENT_BINARY_DIR}/stubs/${header}" DIRECTORY)
  file(MAKE_DIRECTORY "${header_dir}")
  file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/stubs/${header}" "#pragma once\n")
endforeach()

add_executable(screens_fabric_lifecycle lifecycle.cpp
    "${SCREENS_ROOT}/android/src/main/cpp/NativeProxy.cpp"
    "${SCREENS_ROOT}/cpp/RNSScreenRemovalListener.cpp")
target_compile_features(screens_fabric_lifecycle PRIVATE cxx_std_20)
target_include_directories(screens_fabric_lifecycle PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}" "${CMAKE_CURRENT_BINARY_DIR}/stubs"
    "${SCREENS_ROOT}/android/src/main/cpp" "${SCREENS_ROOT}/cpp")
target_compile_options(screens_fabric_lifecycle PRIVATE
    -include "${CMAKE_CURRENT_SOURCE_DIR}/fabric-test-types.h")
