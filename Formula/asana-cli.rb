class AsanaCli < Formula
  desc "Manage your Asana tasks from the command line"
  homepage "https://github.com/pleaseai/asana"
  version "0.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/pleaseai/asana/releases/download/v#{version}/asana-darwin-arm64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # darwin-arm64
    else
      url "https://github.com/pleaseai/asana/releases/download/v#{version}/asana-darwin-x64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # darwin-x64
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/pleaseai/asana/releases/download/v#{version}/asana-linux-arm64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # linux-arm64
    else
      url "https://github.com/pleaseai/asana/releases/download/v#{version}/asana-linux-x64"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000" # linux-x64
    end
  end

  def install
    if OS.mac?
      if Hardware::CPU.arm?
        bin.install "asana-darwin-arm64" => "asana"
      else
        bin.install "asana-darwin-x64" => "asana"
      end
    else
      if Hardware::CPU.arm?
        bin.install "asana-linux-arm64" => "asana"
      else
        bin.install "asana-linux-x64" => "asana"
      end
    end
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/asana --version")
  end
end
