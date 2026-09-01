# frozen_string_literal: true

module ChangedLines
  module_function

  def ranges(base_sha:, head_sha:)
    raise "BASE_SHA is required" if base_sha.to_s.empty?
    raise "HEAD_SHA is required" if head_sha.to_s.empty?

    output = `git diff --unified=0 --no-color #{base_sha}...#{head_sha} -- '*.md' '*.mdx'`
    raise "git diff failed" unless $?.success?

    files = Hash.new { |hash, key| hash[key] = [] }
    current_file = nil

    output.each_line do |line|
      if line.start_with?("+++ b/")
        current_file = line.delete_prefix("+++ b/").strip
      elsif current_file && (match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/))
        start_line = match[1].to_i
        count = (match[2] || "1").to_i
        files[current_file] << (start_line...(start_line + count)) unless count.zero?
      end
    end

    files
  end

  def changed?(ranges, line_number)
    ranges.any? { |range| range.cover?(line_number) }
  end
end
