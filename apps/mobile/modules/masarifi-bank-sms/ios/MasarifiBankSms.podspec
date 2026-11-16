Pod::Spec.new do |s|
  s.name = 'MasarifiBankSms'
  s.version = '1.0.0'
  s.summary = 'Masarifi iOS Shortcuts bank SMS'
  s.homepage = 'https://masarifiratibi.com'
  s.license = { :type => 'Proprietary' }
  s.author = 'Masarifi'
  s.source = { :git => 'https://github.com/masarifiratibi-spec/masarifi.ratibi_app.git' }
  s.platforms = { :ios => '17.0' }
  s.swift_version = '5.10'
  s.static_framework = true
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
  s.source_files = '*.swift'
  s.frameworks = ['JavaScriptCore', 'Security', 'CryptoKit']
  s.dependency 'ExpoModulesCore'
  s.dependency 'ClerkExpo'
  spm_dependency(s,
    url: 'https://github.com/clerk/clerk-ios.git',
    requirement: { :kind => 'exactVersion', :version => '1.5.2' },
    products: ['ClerkKit'])
end
